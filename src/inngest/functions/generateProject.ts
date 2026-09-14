import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { projects, projectJobs, projectFiles, projectVersions, projectMessages } from "@/db/schema/projects";
import { userApiKeys } from "@/db/schema/users";
import { eq, and, desc } from "drizzle-orm";
import { decryptKey } from "@/lib/encryption";
import { aiProviders, getLiveModels, ProviderModel } from "@/lib/ai/registry";
import { NonRetriableError } from "inngest";
import { executeWithProviderChain } from "@/lib/ai/provider-chain";

export const generateProject = inngest.createFunction(
  { 
    id: "generate-project", 
    name: "Generate Project Workflow",
    triggers: [{ event: "project/generate.requested" }],
    cancelOn: [
      {
        event: "project/generation.cancel-requested",
        match: "data.projectId",
      }
    ],
    timeouts: {
      finish: "1h",
    }
  },
  async ({ event, step }) => {
    const { projectId, userId, prompt, attachmentId, mode } = event.data;

    const job = await step.run("initialize-job", async () => {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
      });

      if (!project) throw new Error("Project not found");

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
          updatedAt: new Date(),
        })
        .returning();

      await db
        .update(projects)
        .set({ status: "generating", description: project.description || prompt, activeProvider: selectedProvider, activeModel: selectedModel })
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
            
            if (preferredModel && available.find(m => m.id === preferredModel)) {
               return preferredModel;
            }

            if (isFallback) {
              if (providerId === "openrouter") {
                const freeModels = available.filter(m => m.isFree);
                if (freeModels.length > 0) return freeModels[0].id;
                return null;
              }
              if (providerId === "cerebras" || providerId === "together") {
                return null;
              }
            }
            
            return available[0].id;
          } catch (e) {
            return null;
          }
        };

        const resolvedInitialModel = await resolveProvider(initialProvider, initialModel, false);
        if (resolvedInitialModel) {
          chain.push({ providerId: initialProvider, modelId: resolvedInitialModel });
        }

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
        await db.update(projectJobs).set({ status: "PLANNING", currentStep: "Analyzing requirements", updatedAt: new Date() }).where(eq(projectJobs.id, job.id));
        
        let contextText = "";
        if (attachmentId) {
          const { projectAttachments } = await import("@/db/schema/projects");
          const attachment = await db.query.projectAttachments.findFirst({
            where: eq(projectAttachments.id, attachmentId)
          });
          if (attachment?.extractedText) {
            contextText = `\n\n--- PROVIDED ATTACHMENT CONTEXT ---\n${attachment.extractedText}\n--- END ATTACHMENT CONTEXT ---\n`;
          }
        }

        let currentFilesStr = "";
        let existingVersionId = null;
        if (mode === "modification") {
           const latestVersion = await db.query.projectVersions.findFirst({
             where: eq(projectVersions.projectId, projectId),
             orderBy: [desc(projectVersions.versionNumber)]
           });
           if (latestVersion) {
              existingVersionId = latestVersion.id;
              const files = await db.query.projectFiles.findMany({ where: eq(projectFiles.versionId, latestVersion.id) });
              currentFilesStr = "\n\nCURRENT PROJECT FILES:\n" + files.map(f => `// ${f.path}\n${f.content}`).join("\n\n");
           }
        }

        const systemPrompt = mode === "modification"
        ? `You are an expert software architect. The user wants to modify an existing project.
User request: ${prompt}${contextText}${currentFilesStr}

Output JSON format exactly like this (no markdown wrapping):
{
  "projectType": "static" | "react",
  "framework": "none" | "react",
  "files": [ { "path": "path/to/file", "description": "What this file does, and what changes are needed. If deleting, write 'DELETE'.", "action": "create" | "update" | "delete" } ]
}`
        : `You are an expert software architect.
Create a file structure and implementation plan for the following project:
${prompt}${contextText}

You MUST choose one of the following two standard shapes for the project:
1. Static shape (for simple/non-interactive requests like a "hello world" page):
   Must include index.html, style.css, script.js (or index.html + inline).
2. React shape (for requests implying interactivity/state/multiple views/components, like a todo app):
   Must include package.json, index.html, src/main.tsx, src/App.tsx, src/index.css, and any necessary src/components/*.

Output JSON format exactly like this (no markdown wrapping):
{
  "projectType": "static" | "react",
  "framework": "none" | "react",
  "files": [ { "path": "path/to/file", "description": "What this file does", "action": "create" } ]
}`;

        const { content, providerId, modelId } = await executeWithProviderChain(
           job.id,
           projectId,
           providerChain,
           userId,
           systemPrompt,
           true,
           "Analyzing requirements",
           "planning"
        );
        let parsedPlan: any = {};
        try {
           parsedPlan = JSON.parse(content);
        } catch (e) {
           parsedPlan = { projectType: "static", framework: "none", files: [] };
        }
        
        await db.update(projects).set({ 
          activeProvider: providerId, 
          activeModel: modelId 
        }).where(eq(projects.id, projectId));

        return { plan: parsedPlan, contextText, existingVersionId };
      });

      // 3. Initialize Version for Files
      const versionId = await step.run("initialize-version", async () => {
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
        
        return newVersion.id;
      });

      // 3.5 Copy existing files to new version if modification
      if (mode === "modification" && plan.existingVersionId) {
        await step.run("copy-existing-files", async () => {
          const files = await db.query.projectFiles.findMany({ where: eq(projectFiles.versionId, plan.existingVersionId as string) });
          for (const f of files) {
            await db.insert(projectFiles).values({
              versionId: versionId,
              path: f.path,
              content: f.content
            });
          }
        });
      }

      // 4. Generating Files with Fallback & Upsert
      const filesToGenerate = plan.plan.files || [];
      const generatedFiles: { path: string; error?: string }[] = [];
      
      for (let i = 0; i < filesToGenerate.length; i++) {
        const file = filesToGenerate[i];
        
        const fileResult = await step.run(`generate-file-${i}`, async () => {
          await db.update(projectJobs).set({ status: "GENERATING", currentStep: `Generating ${file.path} (${i + 1}/${filesToGenerate.length})`, updatedAt: new Date() }).where(eq(projectJobs.id, job.id));
          
          if (file.action === "delete") {
            await db.delete(projectFiles).where(and(eq(projectFiles.versionId, versionId), eq(projectFiles.path, file.path)));
            return { path: file.path, success: true, action: "delete" };
          }

          let filePrompt = "You are an expert developer implementing a project.\n" +
"Project Request: " + prompt + (plan.contextText || "") + "\n" +
"Your task is to write the complete content for the file: " + file.path + "\n" +
"Description: " + file.description + "\n\n" +
"Output ONLY a valid JSON object with a single 'content' string property containing the raw file content.\n" +
"Do NOT output markdown outside the JSON. Do NOT output chain-of-thought, thinking process, or conversational preamble.\n" +
"Example JSON format:\n{\n  \"content\": \"raw file content goes here\"\n}";

          let isJsonFormat = true;

          let attempt = 0;
          let finalContent = "";
          let syntaxErrorMsg = "";
          
          while (attempt < 2) {
            let attemptPrompt = filePrompt;
            if (attempt > 0) {
              attemptPrompt += `\n\nYour previous code failed validation with this error:\n${syntaxErrorMsg}\nPlease fix the error and return the corrected JSON.`;
            }

            const { content } = await executeWithProviderChain(
               job.id,
               projectId,
               providerChain,
               userId,
               attemptPrompt,
               isJsonFormat,
               `Generating ${file.path} (${i + 1}/${filesToGenerate.length}) ${attempt > 0 ? '[Repairing]' : ''}`,
               "execution",
               file.path
            );
            
            try {
              const parsed = JSON.parse(content);
              finalContent = parsed.content;
              if (typeof finalContent !== "string") throw new Error("JSON 'content' property must be a string");
              if (!finalContent.trim()) throw new Error("File content cannot be empty");
            } catch (e: any) {
              syntaxErrorMsg = "Failed to parse JSON response or missing 'content' property. " + e.message;
              attempt++;
              continue;
            }
            
            syntaxErrorMsg = "";
            const lowerContent = finalContent.toLowerCase();

            if (lowerContent.includes("here's a thinking process") || lowerContent.includes("here is a thinking process") || lowerContent.includes("sure, i can help") || lowerContent.startsWith("i will write") || lowerContent.startsWith("here is the")) {
               syntaxErrorMsg = "Content appears to contain conversational AI preamble instead of raw source code.";
            }

            if (!syntaxErrorMsg) {
              if (file.path.endsWith('.json') || file.path.toLowerCase() === 'package.json') {
                try {
                  JSON.parse(finalContent);
                } catch (e) {
                  syntaxErrorMsg = "Invalid JSON structure for a JSON file.";
                }
              } else if (file.path.endsWith('.html')) {
                if (!lowerContent.includes("<html") && !lowerContent.includes("<div") && !lowerContent.includes("<body")) {
                  syntaxErrorMsg = "HTML file does not contain valid HTML tags.";
                }
              } else if (file.path.endsWith('.ts') || file.path.endsWith('.tsx') || file.path.endsWith('.js') || file.path.endsWith('.jsx')) {
                const ts = require('typescript');
                try {
                  const result = ts.transpileModule(finalContent, {
                     compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
                     reportDiagnostics: true
                  });
                  const errors = result.diagnostics?.filter((d: any) => d.category === ts.DiagnosticCategory.Error);
                  if (errors && errors.length > 0) {
                     syntaxErrorMsg = ts.flattenDiagnosticMessageText(errors[0].messageText, '\n');
                  }
                } catch (err: any) {
                  syntaxErrorMsg = err.message;
                }
              } else if (file.path.endsWith('.css') || file.path.endsWith('.scss') || file.path.endsWith('.less')) {
                if (!lowerContent.includes("{") || !lowerContent.includes("}")) {
                  syntaxErrorMsg = "CSS file does not contain valid style rules.";
                }
              } else if (file.path.match(/\.(config|rc)\.(js|ts|json|mjs|cjs)$/)) {
                if (finalContent.length < 5) {
                  syntaxErrorMsg = "Config file seems too short or empty.";
                }
              }
            }

            if (syntaxErrorMsg && attempt < 1) {
              attempt++;
              await new Promise(r => setTimeout(r, 2000));
              continue;
            } else if (syntaxErrorMsg) {
              break; 
            }
            
            break; 
          }
          
          if (!syntaxErrorMsg) {
            const existingFile = await db.query.projectFiles.findFirst({
              where: and(eq(projectFiles.versionId, versionId), eq(projectFiles.path, file.path))
            });
            
            if (existingFile) {
              await db.update(projectFiles).set({ content: finalContent }).where(eq(projectFiles.id, existingFile.id));
            } else {
              await db.insert(projectFiles).values({ versionId, path: file.path, content: finalContent });
            }
            return { path: file.path, success: true };
          } else {
            return { path: file.path, error: syntaxErrorMsg };
          }
        });
        
        generatedFiles.push({ path: file.path, error: (fileResult as any).error });
      }

      await step.run("finalize", async () => {
        const hasErrors = generatedFiles.some(f => f.error);
        const finalStatus = hasErrors ? "GENERATED_WITH_ERRORS" : "COMPLETED";
        
        await db.update(projectJobs).set({ 
          status: finalStatus, 
          currentStep: "Complete", 
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(projectJobs.id, job.id));
        
        await db.update(projects).set({ status: "ready" }).where(eq(projects.id, projectId));
      });

    } catch (error: any) {
      await step.run("handle-error", async () => {
        const errorMsg = error instanceof NonRetriableError ? error.message : (error.message || String(error));
        await db.update(projectJobs).set({ 
          status: "FAILED", 
          errorMessage: errorMsg,
          updatedAt: new Date()
        }).where(eq(projectJobs.id, job.id));
        
        await db.update(projects).set({ status: "ready" }).where(eq(projects.id, projectId));
      });
    }
  }
);
