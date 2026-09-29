import { ProviderChain } from '@/lib/ai/provider-chain';
import { ProjectIntent } from '@/lib/intentEngine';
import { executeWithProviderChain } from '@/lib/ai/provider-chain';

/**
 * Uses the LLM to infer a structured ProjectIntent from user prompt, attachment context,
 * and optionally the current project file listing (for modification mode).
 */
export async function extractIntentLLM(
  jobId: string,
  projectId: string,
  userId: string,
  prompt: string,
  attachmentContext: string,
  currentFilesStr: string,
  mode: string,
  providerChain: ProviderChain
): Promise<ProjectIntent> {
  const intentPrompt = `You are an expert AI that infers a structured project intent from a natural language request.
User request: ${prompt}
${attachmentContext ? `Attachment context:\n${attachmentContext}` : ''}
${mode === "modification" && currentFilesStr ? `Current project files:\n${currentFilesStr}` : ''}
Return a JSON object matching the ProjectIntent schema with fields:
- applicationType (WEB_APP, MOBILE_APP, WHATSAPP_BOT, MULTI_COMPONENT)
- intent (short constant like CREATE_PORTFOLIO, CREATE_INSTAGRAM_CLONE, etc.)
- goal (concise description)
- features (array, may be empty)
- inferredRequirements (array, may be empty)
- requiredCapabilities (array, may be empty)
- attachmentTypes (array, may be empty)
- confidence (0‑1 number)
Do NOT include any additional text, only raw JSON.
`;
  const { content } = await executeWithProviderChain(
    jobId,
    projectId,
    providerChain,
    userId,
    intentPrompt,
    true,
    "Extracting Intent",
    "intent"
  );
  try {
    const parsed = JSON.parse(content) as ProjectIntent;
    return parsed;
  } catch (e) {
    console.error('Failed to parse intent JSON', e);
    // Fallback heuristic based on simple regexes
    const lowered = prompt.toLowerCase();
    let applicationType: ProjectIntent["applicationType"] = "WEB_APP";
    let intent = "CREATE_GENERIC_WEB_APP";
    if (/portfolio/.test(lowered)) intent = "CREATE_PORTFOLIO";
    else if (/instagram/.test(lowered)) intent = "CREATE_INSTAGRAM_CLONE";
    else if (/linkedin/.test(lowered)) intent = "CREATE_LINKEDIN_CLONE";
    else if (/bot/.test(lowered) || /whatsapp/.test(lowered)) {
      intent = "CREATE_WHATSAPP_BOT";
      applicationType = "WHATSAPP_BOT";
    }
    return {
      applicationType,
      intent,
      goal: prompt.trim(),
      features: [],
      inferredRequirements: [],
      requiredCapabilities: [],
      attachmentTypes: [],
      confidence: 0.5,
    };
  }
}
