import { auth } from "@/auth";
import { db } from "@/db";
import { projects, projectVersions, projectFiles, projectMessages } from "@/db/schema/projects";
import { userApiKeys } from "@/db/schema/users";
import { eq, and, desc, asc } from "drizzle-orm";
import { decryptKey } from "@/lib/encryption";
import { aiProviders } from "@/lib/ai/registry";
import { inngest } from "@/inngest/client";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { projectId, prompt } = await req.json();
    if (!projectId || !prompt) return new Response("Missing parameters", { status: 400 });

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    });

    if (!project) return new Response("Project not found", { status: 404 });

    if (project.status === "draft") {
      // First prompt - Save to DB so chat history persists immediately
      await db.insert(projectMessages).values({
        projectId: project.id,
        role: "user",
        content: prompt,
      });

      // Dispatch durable generation job
      try {
        await inngest.send({
          name: "project/generate.requested",
          data: {
            projectId: project.id,
            userId: session.user.id,
            prompt: prompt,
          },
        });
      } catch (err: any) {
        console.error("Inngest send error:", err);
        return new Response(`Failed to start generation: ${err.message}`, { status: 500 });
      }

      // Stream a message back to the UI indicating background generation has started
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const msg = "Starting project generation in the background...\nYou can close this tab and the project will continue building.";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }

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

    // Load history from DB
    const dbMessages = await db.query.projectMessages.findMany({
      where: eq(projectMessages.projectId, project.id),
      orderBy: [asc(projectMessages.createdAt)],
    });
    
    // Keep only the most recent 20 messages for context size management
    const serverHistory = dbMessages.slice(-20).map(m => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...serverHistory,
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

    // Save user message
    await db.insert(projectMessages).values({
      projectId: project.id,
      role: "user",
      content: prompt,
    });

    let assistantContent = "";
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder("utf-8").decode(chunk, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices[0]?.delta?.content || "";
              assistantContent += delta;
            } catch (e) {}
          }
        }
        controller.enqueue(chunk);
      },
      async flush() {
        if (assistantContent) {
          try {
            await db.insert(projectMessages).values({
              projectId: project.id,
              role: "assistant",
              content: assistantContent,
            });
          } catch(e) {
            console.error("Failed to save assistant message", e);
          }
        }
      }
    });

    if (!res.body) {
      return new Response("No response body from provider", { status: 500 });
    }

    // Stream directly back to client through our transform stream
    return new Response(res.body.pipeThrough(transformStream), {
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
