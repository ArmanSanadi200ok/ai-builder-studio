// src/lib/intentEngine.ts
/**
 * Simple intent extraction for ABS.
 * Maps natural language prompts to a structured ProjectIntent.
 */
export type ProjectIntent = {
  applicationType: "WEB_APP" | "MOBILE_APP" | "WHATSAPP_BOT" | "MULTI_COMPONENT";
  intent: string;
  goal: string;
  features: string[];
  inferredRequirements: string[];
  requiredCapabilities: string[];
  attachmentTypes: string[];
  confidence: number;
};

/**
 * Very lightweight heuristic implementation – can be expanded with LLM calls.
 */
export function inferIntent(prompt: string): ProjectIntent {
  const lowered = prompt.toLowerCase();
  let applicationType: ProjectIntent["applicationType"] = "WEB_APP";
  let intent = "UNKNOWN";
  const features: string[] = [];
  const inferredRequirements: string[] = [];
  const requiredCapabilities: string[] = [];
  const attachmentTypes: string[] = [];

  if (/portfolio/.test(lowered)) {
    intent = "CREATE_PORTFOLIO";
    features.push("profile sections", "projects list", "contact form");
  } else if (/instagram/.test(lowered)) {
    intent = "CREATE_INSTAGRAM_CLONE";
    features.push("photo feed", "likes", "comments", "user profiles");
  } else if (/linkedin/.test(lowered)) {
    intent = "CREATE_LINKEDIN_CLONE";
    features.push("professional profiles", "connections", "posts", "job listings");
  } else if (/dashboard/.test(lowered)) {
    intent = "CREATE_DASHBOARD";
    features.push("charts", "tables", "filters");
  } else if (/bot/.test(lowered) || /whatsapp/.test(lowered)) {
    intent = "CREATE_WHATSAPP_BOT";
    applicationType = "WHATSAPP_BOT";
    features.push("message handling", "auto replies");
  } else {
    intent = "CREATE_GENERIC_WEB_APP";
    features.push("basic navigation", "responsive UI");
  }

  // Simple requirement inference based on intent
  if (applicationType === "WEB_APP") {
    inferredRequirements.push("public URL", "responsive design");
    requiredCapabilities.push("frontend", "build system");
  } else if (applicationType === "WHATSAPP_BOT") {
    inferredRequirements.push("webhook endpoint", "environment variables for credentials");
    requiredCapabilities.push("backend", "messaging API");
  }

  return {
    applicationType,
    intent,
    goal: prompt.trim(),
    features,
    inferredRequirements,
    requiredCapabilities,
    attachmentTypes,
    confidence: 0.95,
  };
}
