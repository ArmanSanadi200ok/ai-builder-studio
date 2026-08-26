import fs from 'fs';

const content = `import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { projects, projectJobs, projectFiles, projectVersions, projectMessages } from "@/db/schema/projects";
import { userApiKeys } from "@/db/schema/users";
import { eq, and, desc } from "drizzle-orm";
import { decryptKey } from "@/lib/encryption";
import { aiProviders } from "@/lib/ai/registry";
import { NonRetriableError } from "inngest";

async function makeProviderRequest(providerId: string, modelId: string, userId: string, systemPrompt: string, isJson: boolean = false) {
  const aiProvider = aiProviders[providerId];
  if (!aiProvider) throw new Error("Invalid provider");

  let apiKey = "";
  if (aiProvider.requiresKey) {
    const keyRecord = await db.query.userApiKeys.findFirst({
      where: and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, providerId)),
    });
    if (!keyRecord) throw new Error(\`Missing API key for \${providerId}\`);
    apiKey = decryptKey(keyRecord.encryptedKey, keyRecord.iv);
  }

  let baseUrl = "https://api.openai.com/v1";
  if (providerId === "groq") baseUrl = "https://api.groq.com/openai/v1";
  else if (providerId === "openrouter") baseUrl = "https://openrouter.ai/api/v1";
  else if (providerId === "mistral") baseUrl = "https://api.mistral.ai/v1";
  else if (providerId === "deepseek") baseUrl = "https://api.deepseek.com/v1";
  else if (providerId === "together") baseUrl = "https://api.together.xyz/v1";
  else if (providerId === "cerebras") baseUrl = "https://api.cerebras.ai/v1";
  else if (providerId === "anthropic" || providerId === "google") {
    throw { message: \`\${aiProvider.name} is not currently supported for background generation.\`, retryable: false };
  }

  const payload: any = {
    model: modelId,
    messages: [{ role: "system", content: systemPrompt }],
  };
  
  if (isJson) {
    payload.response_format = { type: "json_object" };
  }

  const res = await fetch(\`\${baseUrl}/chat/completions\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: \`Bearer \${apiKey}\`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    const isRetryable = res.status === 429 || res.status >= 500;
    throw { message: \`Provider error \${res.status}: \${errorText}\`, retryable: isRetryable, status: res.status };
  }

  const data = await res.json();
  let content = data.choices[0].message.content;
  if (!isJson && content.startsWith("\`\`\`")) {
    const lines = content.split("\\n");
    if (lines[0].startsWith("\`\`\`")) lines.shift();
    if (lines[lines.length - 1].startsWith("\`\`\`")) lines.pop();
    content = lines.join("\\n");
  }
  return content;
}

async function executeWithProviderChain(
  jobId: string,
  projectId: string,
  initialProvider: string,
  initialModel: string,
  providerChain: string[],
  userId: string,
  prompt: string,
  isJson: boolean,
  stepName: string
) {
  const attemptHistory: string[] = [];
  let currentProviderIndex = 0;
  
  while (currentProviderIndex < providerChain.length) {
    const providerId = providerChain[currentProviderIndex];
    let modelId = (providerId === initialProvider) ? initialModel : "gpt-4o";

    if (providerId !== initialProvider) {
      const aiProv = aiProviders[providerId];
      if (aiProv && aiProv.defaultModels.length > 0) {
         modelId = aiProv.defaultModels[0];
      }
    }

    let attempt = 0;
    let providerExhausted = false;

    while (attempt < 3 && !providerExhausted) {
      try {
        await db.update(projectJobs).set({ 
          currentStep: \`\${stepName} using \${providerId} (\${modelId})\`,
          selectedProvider: providerId,
          selectedModel: modelId
        }).where(eq(projectJobs.id, jobId));
        
        await db.update(projects).set({
          selectedProvider: providerId,
          selectedModel: modelId
        }).where(eq(projects.id, projectId));

        let content = await makeProviderRequest(providerId, modelId, userId, prompt, isJson);
        
        if (isJson) {
           try {
             JSON.parse(content);
           } catch (e: any) {
             throw { message: \`Malformed JSON: \${e.message}\`, retryable: true, status: 400 };
           }
        }
        
        return { content, providerId, modelId };

      } catch (err: any) {
        attempt++;
        const status = err.status;
        const msg = err.message || String(err);
        
        attemptHistory.push(\`[Attempt \${attemptHistory.length + 1}] Provider: \${providerId}, Model: \${modelId}, Status: \${status || 'Unknown'}, Error: \${msg}\`);

        if (status === 401 || status === 403 || status === 402) {
           providerExhausted = true;
           break;
        }

        if (status === 404 || status === 400) {
           const aiProv = aiProviders[providerId];
           if (aiProv && modelId !== aiProv.defaultModels[0]) {
             modelId = aiProv.defaultModels[0];
             continue;
           } else {
             providerExhausted = true;
             break;
           }
        }

        if (status === 429 || (status && status >= 500) || err.retryable) {
           if (attempt < 3) {
             await new Promise(r => setTimeout(r, 2000 * attempt));
             continue;
           } else {
             providerExhausted = true;
             break;
           }
        }

        providerExhausted = true;
        break;
      }
    }
    
    currentProviderIndex++;
  }

  const finalErrorMsg = "No usable provider remains.\\n\\nFallback Trace:\\n" + attemptHistory.join("\\n");
  throw new NonRetriableError(finalErrorMsg);
}

export const generateProject = inngest.createFunction(
  { 
    id: "generate-project", 
    name: "Generate Project Workflow",
    triggers: [{ event: "project/generate.requested" }]
  },
  async ({ event, step }) => {
    const { projectId, userId, prompt } = event.data;

    const job = await step.run("initialize-job", async () => {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
      });

      if (!project) throw new Error("Project not found");

      let providerId = project.selectedProvider || "openai";
      let modelId = project.selectedModel || "gpt-4o";

      const aiProvider = aiProviders[providerId];
      if (aiProvider) {
        let isValid = true;
        
        if (aiProvider.getModels && aiProvider.requiresKey) {
          const keyRecord = await db.query.userApiKeys.findFirst({
            where: and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, providerId)),
          });
          if (keyRecord) {
            try {
              const apiKey = decryptKey(keyRecord.encryptedKey, keyRecord.iv);
              const availableModels = await aiProvider.getModels(apiKey);
              if (availableModels.length > 0 && !availableModels.includes(modelId)) {
                isValid = false;
              }
            } catch (e) {
              console.warn("Failed to discover models for", providerId);
            }
          }
        }

        const isKnownDecommissioned = providerId === "groq" && (modelId.includes("llama3-70b-8192") || modelId.includes("llama3-8b-8192") || modelId === "mixtral-8x7b-32768" || modelId === "openai/gpt-oss-20b");
        
        if (!isValid || isKnownDecommissioned) {
           modelId = aiProvider.defaultModels[0];
           await db.update(projects).set({ selectedModel: modelId }).where(eq(projects.id, projectId));
        }
      }

      const existingActive = await db.query.projectJobs.findFirst({
        where: and(
          eq(projectJobs.projectId, projectId),
          eq(projectJobs.status, "GENERATING")
        ),
      });

      if (existingActive) {
        throw new Error("Job already generating");
      }

      const [newJob] = await db
        .insert(projectJobs)
        .values({
          projectId,
          userId,
          initialPrompt: prompt,
          status: "QUEUED",
          selectedProvider: providerId,
          selectedModel: modelId,
        })
        .returning();

      await db
        .update(projects)
        .set({ status: "queued", description: prompt })
        .where(eq(projects.id, projectId));

      return newJob;
    });

    try {
      // Create Provider Chain
      const providerChain = await step.run("build-provider-chain", async () => {
        const userKeys = await db.query.userApiKeys.findMany({
          where: eq(userApiKeys.userId, userId),
        });
        const availableProviders = userKeys.map(k => k.provider);
        return Array.from(new Set([job.selectedProvider as string, ...availableProviders]));
      });

      // 2. Planning Phase
      const plan = await step.run("planning", async () => {
        await db.update(projectJobs).set({ status: "PLANNING", currentStep: "Analyzing requirements" }).where(eq(projectJobs.id, job.id));
        await db.update(projects).set({ status: "generating" }).where(eq(projects.id, projectId));
        
        const systemPrompt = \`You are an expert software architect.
Create a file structure and implementation plan for the following project:
\${prompt}
Respond in valid JSON format: { "files": [ { "path": "path/to/file.ts", "description": "What this file does" } ] }
Ensure you only output valid JSON without markdown wrapping.\`;

        const { content } = await executeWithProviderChain(
           job.id,
           projectId,
           job.selectedProvider as string,
           job.selectedModel as string,
           providerChain,
           userId,
           systemPrompt,
           true,
           "Analyzing requirements"
        );
        return JSON.parse(content);
      });

      // 3. Generating Files with Fallback
      const generatedFiles = await step.run("generating-files", async () => {
        await db.update(projectJobs).set({ status: "GENERATING", currentStep: "Writing code..." }).where(eq(projectJobs.id, job.id));

        const filesToGenerate = plan.files;
        const results = [];
        
        for (let i = 0; i < filesToGenerate.length; i++) {
          const file = filesToGenerate[i];
          
          let filePrompt = \`You are implementing a project.
Project Request: \${prompt}
Your task is to write the complete content for the file: \${file.path}
Description: \${file.description}

Output ONLY the raw file content. Do not wrap it in markdown code blocks (\`\`\`). No explanations.\`;

          let isJsonFormat = false;
          if (file.path.endsWith('.json')) {
             isJsonFormat = true;
             filePrompt += \`\\nEnsure the output is strictly valid JSON format.\`;
          }

          const { content } = await executeWithProviderChain(
             job.id,
             projectId,
             job.selectedProvider as string,
             job.selectedModel as string,
             providerChain,
             userId,
             filePrompt,
             isJsonFormat,
             \`Generating \${file.path} (\${i + 1}/\${filesToGenerate.length})\`
          );
          
          results.push({
            path: file.path,
            content,
          });
        }

        return results;
      });

      // 4. Persisting Files
      await step.run("persisting-files", async () => {
        await db.update(projectJobs).set({ status: "BUILDING", currentStep: "Saving files to database..." }).where(eq(projectJobs.id, job.id));
        
        const latestVersion = await db.query.projectVersions.findFirst({
          where: eq(projectVersions.projectId, projectId),
          orderBy: [desc(projectVersions.versionNumber)],
        });
        const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
        
        const [newVersion] = await db.insert(projectVersions).values({
          projectId,
          userId,
          promptUsed: prompt,
          versionNumber: newVersionNumber,
        }).returning();

        const fileInserts = generatedFiles.map((f: any) => ({
          versionId: newVersion.id,
          path: f.path,
          content: f.content,
        }));
        
        if (fileInserts.length > 0) {
          await db.insert(projectFiles).values(fileInserts);
        }
      });

      // 5. Completion
      await step.run("completion", async () => {
        await db.update(projectJobs).set({
          status: "COMPLETED",
          currentStep: "Project generated successfully",
          completedAt: new Date(),
        }).where(eq(projectJobs.id, job.id));
        await db.update(projects).set({ status: "ready" }).where(eq(projects.id, projectId));
        
        const fileList = generatedFiles.map((f: any) => \`- \${f.path}\`).join("\\n");
        await db.insert(projectMessages).values({
          projectId: projectId,
          role: "assistant",
          content: \`I have finished generating your project!\\n\\nHere are the files created:\\n\${fileList}\\n\\nYou can now preview the application or ask me to make modifications.\`,
        });
      });

    } catch (error: any) {
      await step.run("mark-failed", async () => {
        await db.update(projectJobs).set({
          status: "FAILED",
          errorMessage: error.message,
          completedAt: new Date(),
        }).where(eq(projectJobs.id, job.id));
        await db.update(projects).set({ status: "failed" }).where(eq(projects.id, projectId));
      });
      throw error;
    }
  }
);
\`;

fs.writeFileSync('src/inngest/functions/generateProject.ts', content);
