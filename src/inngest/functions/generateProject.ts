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
  stage: string;
  file?: string;
  status: string | number;
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

async function makeProviderRequest(providerId: string, modelId: string, apiKey: string, userPrompt: string, isJson: boolean = false, supportsResponseFormat: boolean = true) {
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
    messages: [{ role: "user", content: userPrompt }],
  };
  
  console.log(`[Dispatch] Role Sequence: [${payload.messages.map((m: any) => `'${m.role}'`).join(", ")}]`);

  if (isJson && supportsResponseFormat) {
    payload.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("Request Timeout")), 180000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

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
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError' || err.message === 'Request Timeout') {
        throw { message: "Upstream provider timed out after 180s", status: 408, code: "timeout" };
    }
    throw err;
  }
}

async function executeWithProviderChain(
  jobId: string,
  projectId: string,
  providerChain: { providerId: string, modelId: string }[],
  userId: string,
  prompt: string,
  isJson: boolean,
  stepName: string,
  stage: string,
  filePath?: string
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

    while (attempt < 2 && !providerExhausted) {
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

        // Re-resolve capabilities for live model
        let liveModels: ProviderModel[] = [];
        try {
          liveModels = await getLiveModels(providerId, apiKey as string);
        } catch (e) {}
        const modelInfo = liveModels.find(m => m.id === modelId);
        const supportsResponseFormat = modelInfo?.supportsResponseFormat !== false;

        let content = await makeProviderRequest(providerId, modelId, apiKey as string, prompt, isJson, supportsResponseFormat);
        
        if (isJson) {
           if (content !== null && content !== undefined) {
             const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
             if (jsonMatch) {
               content = jsonMatch[1].trim();
             } else {
               const braceMatch = content.match(/(\{|\[)[\s\S]*(\}|\])/);
               if (braceMatch) {
                 content = braceMatch[0];
               }
             }
           }
           
           try {
             const parsed = JSON.parse(content);
             if (parsed === null || typeof parsed !== 'object') {
               throw new Error("Parsed JSON was not an object");
             }
           } catch (e: any) {
             throw { message: `Malformed JSON: ${e.message}`, status: 400, code: "malformed_json" };
           }
        }
        
        attemptHistory.push({
          provider: providerId,
          model: modelId,
          stage: stage,
          file: filePath,
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
          stage: stage,
          file: filePath,
          status: status === 408 ? "timeout" : status,
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
           if (code === "malformed_json") {
             if (attempt < 2) {
               attemptHistory.push(record);
               await new Promise(r => setTimeout(r, 2000 * attempt));
               continue;
             } else {
               record.result = "fallback";
               attemptHistory.push(record);
               providerExhausted = true;
               break;
             }
           } else {
             // Not a model error, malformed request etc. Do not fallback models.
             record.result = "failed";
             attemptHistory.push(record);
             throw new NonRetriableError(`Irrecoverable 400 Bad Request: ${msg}`);
           }
        }

        if (status === 408 || status === 429 || status >= 500) {
           if (attempt < 2) {
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
    const { projectId, userId, prompt, attachmentId } = event.data;

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

        const systemPrompt = `You are an expert software architect.
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
  "files": [ { "path": "path/to/file", "description": "What this file does" } ]
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

        return { plan: parsedPlan, contextText };
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

      // 4. Generating Files with Fallback & Upsert
      const filesToGenerate = plan.plan.files || [];
      const generatedFiles: { path: string; error?: string }[] = [];
      
      for (let i = 0; i < filesToGenerate.length; i++) {
        const file = filesToGenerate[i];
        
        const fileResult = await step.run(`generate-file-${i}`, async () => {
          await db.update(projectJobs).set({ status: "GENERATING", currentStep: `Generating ${file.path} (${i + 1}/${filesToGenerate.length})` }).where(eq(projectJobs.id, job.id));
          
          let filePrompt = "You are implementing a project.\n" +
"Project Request: " + prompt + (plan.contextText || "") + "\n" +
"Your task is to write the complete content for the file: " + file.path + "\n" +
"Description: " + file.description + "\n\n" +
"Output ONLY the raw file content. Do not wrap it in markdown code blocks (```). No explanations.";

          let isJsonFormat = false;
          if (file.path.endsWith('.json')) {
             isJsonFormat = true;
             filePrompt += "\nEnsure the output is strictly valid JSON format.";
          }

          let attempt = 0;
          let finalContent = "";
          let syntaxErrorMsg = "";
          
          while (attempt < 2) {
            let attemptPrompt = filePrompt;
            if (attempt > 0) {
              attemptPrompt += `\n\nYour previous code failed syntax validation with this error:\n${syntaxErrorMsg}\nPlease fix the syntax error and return the corrected raw code.`;
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
            
            finalContent = content;
            syntaxErrorMsg = "";

            if (!isJsonFormat && (file.path.endsWith('.ts') || file.path.endsWith('.tsx') || file.path.endsWith('.js') || file.path.endsWith('.jsx'))) {
              const ts = require('typescript');
              try {
                // If it parses and transpiles without throwing an error, syntax is roughly okay
                // transpileModule doesn't throw on all syntax errors (it emits diagnostics), so we check diagnostics
                const result = ts.transpileModule(content, {
                   compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
                   reportDiagnostics: true
                });
                
                const errors = result.diagnostics?.filter((d: any) => d.category === ts.DiagnosticCategory.Error);
                if (errors && errors.length > 0) {
                   const msg = ts.flattenDiagnosticMessageText(errors[0].messageText, '\n');
                   throw new Error(msg);
                }
                
                break; // Valid syntax
              } catch (err: any) {
                syntaxErrorMsg = err.message;
              }
            } else {
              break; // Not a ts/js file
            }
            
            attempt++;
          }
          
          // UPSERT logic inside the step
          const existingFile = await db.query.projectFiles.findFirst({
            where: and(eq(projectFiles.versionId, versionId), eq(projectFiles.path, file.path))
          });
          
          if (existingFile) {
            await db.update(projectFiles).set({ content: finalContent }).where(eq(projectFiles.id, existingFile.id));
          } else {
            await db.insert(projectFiles).values({ versionId, path: file.path, content: finalContent });
          }
          
          return { path: file.path, error: syntaxErrorMsg };
        });
        
        generatedFiles.push(fileResult);
      }

      // 5. Validation
      await step.run("validate-project", async () => {
        await db.update(projectJobs).set({ status: "VALIDATING", currentStep: "Validating generated files" }).where(eq(projectJobs.id, job.id));
        
        const files = await db.query.projectFiles.findMany({
          where: eq(projectFiles.versionId, versionId)
        });
        
        const requiredStatic = ["index.html"];
        const requiredReact = ["package.json", "index.html", "src/main.tsx", "src/App.tsx"];
        const required = plan.plan.projectType === "react" ? requiredReact : requiredStatic;
        
        const missing = required.filter(p => !files.find(f => f.path.toLowerCase() === p.toLowerCase()));
        if (missing.length > 0) {
           await db.update(projectJobs).set({ status: "GENERATED_WITH_ERRORS", errorMessage: `Missing required files: ${missing.join(", ")}` }).where(eq(projectJobs.id, job.id));
           await db.update(projects).set({ status: "generated_with_errors" }).where(eq(projects.id, projectId));
           return;
        }

        const hasSyntaxErrors = generatedFiles.some(f => f.error);
        if (hasSyntaxErrors) {
           const errFiles = generatedFiles.filter(f => f.error).map(f => f.path).join(', ');
           await db.update(projectJobs).set({ status: "GENERATED_WITH_ERRORS", errorMessage: `Syntax errors remain in: ${errFiles}` }).where(eq(projectJobs.id, job.id));
           await db.update(projects).set({ status: "generated_with_errors" }).where(eq(projects.id, projectId));
           return;
        }

        await db.update(projectJobs).set({
          status: "COMPLETED",
          currentStep: "Project generated successfully",
          completedAt: new Date(),
        }).where(eq(projectJobs.id, job.id));
        await db.update(projects).set({ status: "ready" }).where(eq(projects.id, projectId));
      });
      
      await step.run("completion-message", async () => {
        
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
