import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { projects, projectJobs, projectFiles, projectVersions } from "@/db/schema/projects";
import { userApiKeys } from "@/db/schema/users";
import { eq, and, desc } from "drizzle-orm";
import { decryptKey } from "@/lib/encryption";
import { aiProviders } from "@/lib/ai/registry";

async function makeProviderRequest(providerId: string, modelId: string, userId: string, systemPrompt: string, isJson: boolean = false) {
  const aiProvider = aiProviders[providerId];
  if (!aiProvider) throw new Error("Invalid provider");

  let apiKey = "";
  if (aiProvider.requiresKey) {
    const keyRecord = await db.query.userApiKeys.findFirst({
      where: and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, providerId)),
    });
    if (!keyRecord) throw new Error(`Missing API key for ${providerId}`);
    apiKey = decryptKey(keyRecord.encryptedKey, keyRecord.iv);
  }

  let baseUrl = "https://api.openai.com/v1";
  if (providerId === "groq") baseUrl = "https://api.groq.com/openai/v1";

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
    const errorText = await res.text();
    const isRetryable = res.status === 429 || res.status >= 500;
    throw { message: `Provider error ${res.status}: ${errorText}`, retryable: isRetryable };
  }

  const data = await res.json();
  let content = data.choices[0].message.content;
  if (!isJson && content.startsWith("\`\`\`")) {
    const lines = content.split("\n");
    if (lines[0].startsWith("\`\`\`")) lines.shift();
    if (lines[lines.length - 1].startsWith("\`\`\`")) lines.pop();
    content = lines.join("\n");
  }
  return content;
}

export const generateProject = inngest.createFunction(
  { 
    id: "generate-project", 
    name: "Generate Project Workflow",
    triggers: [{ event: "project/generate.requested" }]
  },
  async ({ event, step }) => {
    const { projectId, userId, prompt } = event.data;

    // 1. Initial validation & Job Setup
    const job = await step.run("initialize-job", async () => {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
      });

      if (!project) throw new Error("Project not found");

      let providerId = project.selectedProvider || "openai";
      let modelId = project.selectedModel || "gpt-4o";
      if (providerId === "groq" && modelId === "mixtral-8x7b-32768") {
        modelId = "openai/gpt-oss-20b";
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
      // 2. Planning Phase
      const plan = await step.run("planning", async () => {
        await db.update(projectJobs).set({ status: "PLANNING", currentStep: "Analyzing requirements" }).where(eq(projectJobs.id, job.id));
        await db.update(projects).set({ status: "generating" }).where(eq(projects.id, projectId));
        
        const systemPrompt = `You are an expert software architect.
Create a file structure and implementation plan for the following project:
${prompt}
Respond in valid JSON format: { "files": [ { "path": "path/to/file.ts", "description": "What this file does" } ] }
Ensure you only output valid JSON without markdown wrapping.`;

        // We will attempt with the user's primary provider first
        try {
          const content = await makeProviderRequest(job.selectedProvider as string, job.selectedModel as string, userId, systemPrompt, true);
          return JSON.parse(content);
        } catch (error: any) {
          throw new Error(`Planning failed: ${error.message}`);
        }
      });

      // 3. Generating Files with Fallback
      const generatedFiles = await step.run("generating-files", async () => {
        await db.update(projectJobs).set({ status: "GENERATING", currentStep: "Writing code..." }).where(eq(projectJobs.id, job.id));

        const filesToGenerate = plan.files;
        const results = [];
        
        // Define fallback chain based on available keys for this user
        const userKeys = await db.query.userApiKeys.findMany({
          where: eq(userApiKeys.userId, userId),
        });
        
        const availableProviders = userKeys.map(k => k.provider);
        // Put the selected provider first, then the rest
        let providerChain = [job.selectedProvider as string, ...availableProviders.filter(p => p !== job.selectedProvider)];
        // Add openai unconditionally (assumed free/mocked/default if no keys but supported without keys? No, requires key).
        // The makeProviderRequest will throw if key is missing and required.
        
        let currentProviderIndex = 0;

        for (let i = 0; i < filesToGenerate.length; i++) {
          const file = filesToGenerate[i];
          
          let success = false;
          let attempt = 0;
          let content = "";

          while (!success && currentProviderIndex < providerChain.length) {
            const providerId = providerChain[currentProviderIndex];
            let modelId = job.selectedModel as string;
            if (providerId !== job.selectedProvider) {
              if (providerId === "groq") modelId = "openai/gpt-oss-20b";
              else if (providerId === "openrouter") modelId = "openai/gpt-4o";
              else modelId = "gpt-4o";
            }
            
            await db.update(projectJobs).set({ 
              currentStep: `Generating ${file.path} (${i + 1}/${filesToGenerate.length}) using ${providerId}`,
              selectedProvider: providerId,
              selectedModel: modelId
            }).where(eq(projectJobs.id, job.id));
            
            const filePrompt = `You are implementing a project.
Project Request: ${prompt}
Your task is to write the complete content for the file: ${file.path}
Description: ${file.description}

Output ONLY the raw file content. Do not wrap it in markdown code blocks (\`\`\`). No explanations.`;

            try {
              content = await makeProviderRequest(providerId, modelId, userId, filePrompt, false);
              success = true;
            } catch (err: any) {
              if (err.retryable) {
                attempt++;
                if (attempt >= 3) {
                  // Exhausted retries for this provider, failover
                  currentProviderIndex++;
                  attempt = 0;
                } else {
                  await new Promise(r => setTimeout(r, 2000));
                }
              } else {
                // Non retryable (like missing API key), immediately failover
                currentProviderIndex++;
                attempt = 0;
              }
            }
          }

          if (!success) {
            throw new Error(`Failed to generate ${file.path} after exhausting all providers. No available fallback provider remains.`);
          }
          
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
        
        // 4a. Create a project Version
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

        // 4b. Insert Files
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
