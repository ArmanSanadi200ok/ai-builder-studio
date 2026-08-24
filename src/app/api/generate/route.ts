import { auth } from "@/auth";
import { db } from "@/db";
import { projects, projectVersions, projectFiles } from "@/db/schema/projects";
import { userApiKeys } from "@/db/schema/users";
import { eq, and, desc } from "drizzle-orm";
import { decryptKey } from "@/lib/encryption";
import { aiProviders } from "@/lib/ai/registry";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { projectId, prompt, history = [] } = await req.json();
    if (!projectId || !prompt) return new Response("Missing parameters", { status: 400 });

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    });

    if (!project) return new Response("Project not found", { status: 404 });

    const providerId = project.selectedProvider || "openai";
    let modelId = project.selectedModel || "gpt-4o";
    if (providerId === "groq" && modelId === "mixtral-8x7b-32768") {
      modelId = "openai/gpt-oss-20b";
    }
    const aiProvider = aiProviders[providerId];

    if (!aiProvider) return new Response("Invalid provider", { status: 400 });

    if (aiProvider.category === "abs") {
      return new Response("ABS providers are coming soon. Please use a Personal LLM.", { status: 400 });
    }

    let apiKey = "";
    if (aiProvider.requiresKey) {
      const keyRecord = await db.query.userApiKeys.findFirst({
        where: and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, providerId)),
      });
      if (!keyRecord) return new Response(`Missing API key for ${aiProvider.name}`, { status: 400 });
      apiKey = decryptKey(keyRecord.encryptedKey, keyRecord.iv);
    }

    // OpenAI compatible streaming
    let baseUrl = "https://api.openai.com/v1";
    if (providerId === "groq") baseUrl = "https://api.groq.com/openai/v1";
    else if (providerId === "openrouter") baseUrl = "https://openrouter.ai/api/v1";
    else if (providerId === "deepseek") baseUrl = "https://api.deepseek.com/v1";
    else if (providerId === "mistral") baseUrl = "https://api.mistral.ai/v1";
    else if (providerId === "cerebras") baseUrl = "https://api.cerebras.ai/v1";
    else if (providerId === "together") baseUrl = "https://api.together.xyz/v1";
    else if (providerId === "ollama") baseUrl = "http://localhost:11434/v1"; 
    else if (providerId === "anthropic" || providerId === "google") {
      return new Response(`${aiProvider.name} streaming is not yet supported in this foundation. Please use Groq or OpenAI.`, { status: 400 });
    }

    // Fetch latest project state if it exists
    const latestVersion = await db.query.projectVersions.findFirst({
      where: eq(projectVersions.projectId, project.id),
      orderBy: [desc(projectVersions.versionNumber)],
    });

    let currentProjectState = "No files generated yet.";
    if (latestVersion) {
      const files = await db.query.projectFiles.findMany({
        where: eq(projectFiles.versionId, latestVersion.id),
      });
      if (files.length > 0) {
        currentProjectState = files.map(f => `// ${f.path}\n${f.content}`).join("\n\n");
      }
    }

    const systemPrompt = `You are the AI coding assistant working inside AI Builder Studio.

Current project:
Name: ${project.name}
Original project request:
${project.description || "No description provided."}
Project ID: ${project.id}
Current Provider: ${providerId}
Current Model: ${modelId}
Project Status: ${project.status}

Latest Generated State:
${currentProjectState}

Your job is to help the user build and modify this specific project. Respond in markdown containing the code implementation.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: prompt }
    ];

    const payload = {
      model: modelId,
      messages,
      stream: true,
    };

    const headers: any = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    };
    if (providerId === "openrouter") headers["HTTP-Referer"] = process.env.AUTH_URL || "http://localhost:3000";

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(`Provider Error: ${res.status} ${err}`, { status: res.status });
    }

    // Stream directly back to client
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (err: any) {
    console.error("Generate API error:", err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
