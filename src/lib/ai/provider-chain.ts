import { db } from "@/db";
import { projects, projectJobs } from "@/db/schema/projects";
import { userApiKeys } from "@/db/schema/users";
import { eq, and } from "drizzle-orm";
import { decryptKey } from "@/lib/encryption";
import { aiProviders, getLiveModels, ProviderModel } from "@/lib/ai/registry";
import { NonRetriableError } from "inngest";

export type AttemptRecord = {
  provider: string;
  model: string;
  stage: string;
  file?: string;
  status: string | number;
  code: string;
  retryCount: number;
  result: "success" | "failed" | "fallback";
};

export async function getDecryptedKey(providerId: string, userId: string): Promise<string | null> {
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

export async function makeProviderRequest(providerId: string, modelId: string, apiKey: string, userPrompt: string, isJson: boolean = false, supportsResponseFormat: boolean = true) {
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
  
  if (isJson && supportsResponseFormat) {
    payload.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("Request Timeout")), 40000); // 40 SECONDS TIMEOUT

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
        throw { message: "Upstream provider timed out after 40s", status: 408, code: "timeout" };
    }
    throw err;
  }
}

export async function executeWithProviderChain(
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
  const globalStartTime = Date.now();
  const GLOBAL_TIMEOUT_MS = 180000; // 180 seconds global timeout
  
  const attemptHistory: AttemptRecord[] = [];
  
  let currentProviderIndex = 0;
  
  while (currentProviderIndex < providerChain.length) {
    // Check global timeout boundary
    if (Date.now() - globalStartTime > GLOBAL_TIMEOUT_MS) {
       console.log(`[Diagnostic] executeWithProviderChain exceeded global timeout of ${GLOBAL_TIMEOUT_MS}ms. Aborting.`);
       throw new NonRetriableError(`Generation exceeded safety timeout of 3 minutes. Please try again.`);
    }

    let { providerId, modelId } = providerChain[currentProviderIndex];
    let apiKey = await getDecryptedKey(providerId, userId);
    
    if (apiKey === null) {
      currentProviderIndex++;
      continue;
    }

    let attempt = 0;
    let providerExhausted = false;

    while (attempt < 2 && !providerExhausted) {
      // Check global timeout boundary again inside the loop
      if (Date.now() - globalStartTime > GLOBAL_TIMEOUT_MS) {
         throw new NonRetriableError(`Generation exceeded safety timeout of 3 minutes. Please try again.`);
      }

      const iterationStartTime = Date.now();
      try {
        if (jobId) {
          await db.update(projectJobs).set({ 
            currentStep: `${stepName} using ${providerId} (${modelId})`,
            activeProvider: providerId,
            activeModel: modelId
          }).where(eq(projectJobs.id, jobId));
        }
        
        await db.update(projects).set({
          activeProvider: providerId,
          activeModel: modelId
        }).where(eq(projects.id, projectId));

        let liveModels: ProviderModel[] = [];
        try {
          liveModels = await getLiveModels(providerId, apiKey as string);
        } catch (e) {}
        const modelInfo = liveModels.find(m => m.id === modelId);
        const supportsResponseFormat = modelInfo?.supportsResponseFormat !== false;

        let content = await makeProviderRequest(providerId, modelId, apiKey as string, prompt, isJson, supportsResponseFormat);
        
        const iterationDurationMs = Date.now() - iterationStartTime;
        console.log(`[Timing] ${projectId} | ${jobId} | ${providerId} | ${modelId} | ${stage} | Start: ${iterationStartTime} | End: ${Date.now()} | Duration: ${iterationDurationMs}ms | Status: 200 | Result: completed`);

        if (isJson) {
           let rawContent = content;
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
        
        const iterationDurationMs = Date.now() - iterationStartTime;
        console.log(`[Timing] ${projectId} | ${jobId} | ${providerId} | ${modelId} | ${stage} | Start: ${iterationStartTime} | End: ${Date.now()} | Duration: ${iterationDurationMs}ms | Status: ${status} | Result: threw (${code})`);

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

        if (status === 401 || status === 403 || status === 402) {
           record.result = "fallback";
           attemptHistory.push(record);
           providerExhausted = true;
           break;
        }

        if (status === 404 || (status === 400 && (code === "model_not_found" || code === "model_decommissioned" || msg.toLowerCase().includes("model")))) {
           try {
             const liveModels = await getLiveModels(providerId, apiKey as string);
             const available = liveModels.filter(m => m.isAvailable);
             if (available.length > 0 && available[0].id !== modelId) {
               record.result = "fallback";
               attemptHistory.push(record);
               modelId = available[0].id;
               continue; 
             }
           } catch (e) {}
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
