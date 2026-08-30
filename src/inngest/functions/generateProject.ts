import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { projects, projectJobs, projectFiles, projectVersions, projectMessages } from "@/db/schema/projects";
import { userApiKeys } from "@/db/schema/users";
import { eq, and, desc } from "drizzle-orm";
import { decryptKey } from "@/lib/encryption";
import { aiProviders, getLiveModels, ProviderModel } from "@/lib/ai/registry";
import { NonRetriableError } from "inngest";

type AttemptRecord = {
  provider: string;
  model: string;
  status: number;
  code: string;
  retryCount: number;
  result: "success" | "failed" | "fallback";
};

async function getDecryptedKey(providerId: string, userId: string): Promise<string | null> {
  const aiProvider = aiProviders[providerId];
  if (!aiProvider || !aiProvider.requiresKey) return "";
  
  const keyRecord = await db.query.userApiKeys.findFirst({
    where: and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, providerId)),
  });
  if (!keyRecord) return null;
  
  try {
    return decryptKey(keyRecord.encryptedKey, keyRecord.iv);
  } catch (e) {
    return null;
  }
}

async function makeProviderRequest(providerId: string, modelId: string, apiKey: string, systemPrompt: string, isJson: boolean = false) {
  let baseUrl = "https://api.openai.com/v1";
  if (providerId === "groq") baseUrl = "https://api.groq.com/openai/v1";
  else if (providerId === "openrouter") baseUrl = "https://openrouter.ai/api/v1";
  else if (providerId === "mistral") baseUrl = "https://api.mistral.ai/v1";
  else if (providerId === "deepseek") baseUrl = "https://api.deepseek.com/v1";
  else if (providerId === "together") baseUrl = "https://api.together.xyz/v1";
  else if (providerId === "cerebras") baseUrl = "https://api.cerebras.ai/v1";
  else if (providerId === "anthropic" || providerId === "google") {
    throw { message: `${aiProviders[providerId]?.name} is not currently supported for background generation.`, status: 400 };
  }

  const payload: any = {
    model: modelId,
    messages: [{ role: "system", content: systemPrompt }],
  };
  
  if (isJson) {
    payload.response_format = { type: "json_object" };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorText = await res.text();
    let errorCode = "unknown";
    try {
      const j = JSON.parse(errorText);
      errorCode = j.error?.code || j.error?.type || errorCode;
      errorText = j.error?.message || errorText;
    } catch (e) {}
    
    throw { message: errorText, status: res.status, code: errorCode };
  }

  const data = await res.json();
  let content = data.choices[0].message.content;
  if (!isJson && content.startsWith("```")) {
    const lines = content.split("\n");
    if (lines[0].startsWith("```")) lines.shift();
    if (lines[lines.length - 1].startsWith("```")) lines.pop();
    content = lines.join("\n");
  }
  return content;
}

async function executeWithProviderChain(
  jobId: string,
  projectId: string,
  providerChain: { providerId: string, modelId: string }[],
  userId: string,
  prompt: string,
  isJson: boolean,
  stepName: string
) {
  const attemptHistory: AttemptRecord[] = [];
  
  let currentProviderIndex = 0;
  
  while (currentProviderIndex < providerChain.length) {
    let { providerId, modelId } = providerChain[currentProviderIndex];
    let apiKey = await getDecryptedKey(providerId, userId);
    
    if (apiKey === null) {
      currentProviderIndex++;
      continue;
    }

    let attempt = 0;
    let providerExhausted = false;

    while (attempt < 3 && !providerExhausted) {
      try {
        await db.update(projectJobs).set({ 
          currentStep: `${stepName} using ${providerId} (${modelId})`,
          activeProvider: providerId,
          activeModel: modelId
        }).where(eq(projectJobs.id, jobId));
        
        await db.update(projects).set({
          activeProvider: providerId,
          activeModel: modelId
        }).where(eq(projects.id, projectId));

        let content = await makeProviderRequest(providerId, modelId, apiKey as string, prompt, isJson);
        
        if (isJson) {
           try {
             JSON.parse(content);
           } catch (e: any) {
             throw { message: `Malformed JSON: ${e.message}`, status: 400, code: "malformed_json" };
           }
        }
        
        attemptHistory.push({
          provider: providerId,
          model: modelId,
          status: 200,
          code: "success",
          retryCount: attempt,
          result: "success"
        });
        
        return { content, providerId, modelId };

      } catch (err: any) {
        attempt++;
        const status = err.status || 500;
        const msg = err.message || String(err);
        const code = err.code || "unknown";
        
        const record: AttemptRecord = {
          provider: providerId,
          model: modelId,
          status: status,
          code: code,
          retryCount: attempt,
          result: "failed"
        };

        if (status === 401 || status === 403) {
           record.result = "fallback";
           attemptHistory.push(record);
           providerExhausted = true;
           break;
        }
        
        if (status === 402) {
           record.result = "fallback";
           attemptHistory.push(record);
           providerExhausted = true;
           break;
        }

        if (status === 404 || (status === 400 && (code === "model_not_found" || code === "model_decommissioned" || msg.toLowerCase().includes("model")))) {
           // Model specifically failed. Resolve live again.
           try {
             // Must get fresh api key for live resolution
             const liveModels = await getLiveModels(providerId, apiKey as string);
             const available = liveModels.filter(m => m.isAvailable);
             if (available.length > 0 && available[0].id !== modelId) {
               record.result = "fallback";
               attemptHistory.push(record);
               modelId = available[0].id;
               continue; // Same provider, new model
             }
           } catch (e) {
             // Failed to resolve live models
           }
           record.result = "fallback";
           attemptHistory.push(record);
           providerExhausted = true;
           break;
        }
        
        if (status === 400) {
           // Not a model error, malformed request etc. Do not fallback models.
           record.result = "failed";
           attemptHistory.push(record);
           throw new NonRetriableError(`Irrecoverable 400 Bad Request: ${msg}`);
        }

        if (status === 429 || status >= 500) {
           if (attempt < 3) {
             attemptHistory.push(record);
             await new Promise(r => setTimeout(r, 2000 * attempt));
             continue;
           } else {
             record.result = "fallback";
             attemptHistory.push(record);
             providerExhausted = true;
             break;
           }
        }

        record.result = "fallback";
        attemptHistory.push(record);
        providerExhausted = true;
        break;
      }
    }
    
    currentProviderIndex++;
  }

  const historyStr = attemptHistory.map((r, i) => 
    `[${i+1}] ${r.provider}/${r.model} | ${r.status} ${r.code} (${r.result})`
  ).join("\n");
  
  throw new NonRetriableError(`No usable provider remains.\nFallback Trace:\n${historyStr}`);
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

      const existingActive = await db.query.projectJobs.findFirst({
        where: and(
          eq(projectJobs.projectId, projectId),
          eq(projectJobs.status, "GENERATING")
        ),
      });

      if (existingActive) {
        throw new Error("Job already generating");
      }

      let selectedProvider = project.selectedProvider || "openai";
      let selectedModel = project.selectedModel || "gpt-4o";

      const [newJob] = await db
        .insert(projectJobs)
        .values({
          projectId,
          userId,
          initialPrompt: prompt,
          status: "QUEUED",
          selectedProvider: selectedProvider,
          selectedModel: selectedModel,
          activeProvider: selectedProvider,
          activeModel: selectedModel,
        })
        .returning();

      await db
        .update(projects)
        .set({ status: "queued", description: prompt, activeProvider: selectedProvider, activeModel: selectedModel })
        .where(eq(projects.id, projectId));

      return newJob;
    });

    try {
      // Create Provider Chain
      const providerChain = await step.run("build-provider-chain", async () => {
        let initialProvider = job.selectedProvider || "openai";
        let initialModel = job.selectedModel || "gpt-4o";

        const userKeys = await db.query.userApiKeys.findMany({
          where: eq(userApiKeys.userId, userId),
        });
        
        const chain: { providerId: string, modelId: string }[] = [];
        
        // 1. Add requested provider first
        const keyMap = new Map(userKeys.map(k => [k.provider, k]));
        
        const resolveProvider = async (providerId: string, preferredModel: string, isFallback: boolean) => {
          const keyRecord = keyMap.get(providerId);
          if (!keyRecord) return null;
          let apiKey = "";
          try { apiKey = decryptKey(keyRecord.encryptedKey, keyRecord.iv); } catch (e) { return null; }
          
          try {
            const liveModels = await getLiveModels(providerId, apiKey);
            const available = liveModels.filter(m => m.isAvailable);
            if (available.length === 0) return null;
            
            // If preferred model is in liveModels, use it
            if (preferredModel && available.find(m => m.id === preferredModel)) {
               return preferredModel;
            }

            if (isFallback) {
              if (providerId === "openrouter") {
                const freeModels = available.filter(m => m.isFree);
                if (freeModels.length > 0) return freeModels[0].id;
                return null; // Avoid silent 402 on paid models if no credit confirmation
              }
              if (providerId === "cerebras" || providerId === "together") {
                // Cannot guarantee free tier anymore, avoid as automatic fallback
                return null;
              }
            }
            
            // Otherwise fallback to first available
            return available[0].id;
          } catch (e) {
            return null;
          }
        };

        const resolvedInitialModel = await resolveProvider(initialProvider, initialModel, false);
        if (resolvedInitialModel) {
          chain.push({ providerId: initialProvider, modelId: resolvedInitialModel });
        }

        // 2. Add other configured providers as fallbacks
        for (const providerId of keyMap.keys()) {
          if (providerId === initialProvider) continue;
          
          const resolvedFallbackModel = await resolveProvider(providerId, "", true);
          if (resolvedFallbackModel) {
             chain.push({ providerId, modelId: resolvedFallbackModel });
          }
        }
        
        if (chain.length === 0) {
           throw new NonRetriableError("No valid API keys or models available.");
        }

        return chain;
      });

      // 2. Planning Phase
      const plan = await step.run("planning", async () => {
        await db.update(projectJobs).set({ status: "PLANNING", currentStep: "Analyzing requirements" }).where(eq(projectJobs.id, job.id));
        await db.update(projects).set({ status: "generating" }).where(eq(projects.id, projectId));
        
        const systemPrompt = `You are an expert software architect.
Create a file structure and implementation plan for the following project:
${prompt}
Respond in valid JSON format: { "files": [ { "path": "path/to/file.ts", "description": "What this file does" } ] }
Ensure you only output valid JSON without markdown wrapping.`;

        const { content } = await executeWithProviderChain(
           job.id,
           projectId,
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
          
          let filePrompt = `You are implementing a project.
Project Request: ${prompt}
Your task is to write the complete content for the file: ${file.path}
Description: ${file.description}

Output ONLY the raw file content. Do not wrap it in markdown code blocks (\`\`\`). No explanations.`;

          let isJsonFormat = false;
          if (file.path.endsWith('.json')) {
             isJsonFormat = true;
             filePrompt += `\nEnsure the output is strictly valid JSON format.`;
          }

          const { content } = await executeWithProviderChain(
             job.id,
             projectId,
             providerChain,
             userId,
             filePrompt,
             isJsonFormat,
             `Generating ${file.path} (${i + 1}/${filesToGenerate.length})`
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
        
        const fileList = generatedFiles.map((f: any) => "- " + f.path).join("\n");
        await db.insert(projectMessages).values({
          projectId: projectId,
          role: "assistant",
          content: "I have finished generating your project!\n\nHere are the files created:\n" + fileList + "\n\nYou can now preview the application or ask me to make modifications.",
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
