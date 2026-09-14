import { auth } from "@/auth";
import { db } from "@/db";
import { projects, projectVersions, projectFiles, projectMessages, projectJobs } from "@/db/schema/projects";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { projectId, prompt, regenerate, attachmentId } = await req.json();
    if (!projectId || !prompt) return new Response("Missing parameters", { status: 400 });

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    });

    if (!project) return new Response("Project not found", { status: 404 });

    const activeJobs = await db.query.projectJobs.findMany({
      where: and(
        eq(projectJobs.projectId, projectId),
        inArray(projectJobs.status, ["QUEUED", "PLANNING", "GENERATING"])
      ),
    });

    let hasActiveJob = false;
    for (const job of activeJobs) {
      const isStale = (Date.now() - job.updatedAt.getTime()) > 5 * 60 * 1000; // 5 minutes
      if (isStale) {
        console.log(`[Stale Job Recovery] Recovering stale job ${job.id}`);
        await db.update(projectJobs).set({
          status: "FAILED",
          errorMessage: "Job timed out and was automatically recovered.",
          updatedAt: new Date()
        }).where(eq(projectJobs.id, job.id));
      } else {
        hasActiveJob = true;
      }
    }

    if (hasActiveJob) {
      return new Response("A generation is already running for this project", { status: 409 });
    }

    // Save to DB so chat history persists immediately
    await db.insert(projectMessages).values({
      projectId: project.id,
      role: "user",
      content: prompt,
    });

    const isInitial = project.status === "draft" || regenerate;
    const mode = isInitial ? "initial" : "modification";

    // Dispatch durable generation job
    try {
      await inngest.send({
        name: "project/generate.requested",
        data: {
          projectId: project.id,
          userId: session.user.id,
          prompt: prompt,
          attachmentId: attachmentId || null,
          mode: mode,
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
        const msg = isInitial
          ? "Starting project generation in the background...\nYou can close this tab and the project will continue building."
          : "Starting project modification in the background...\nYou can close this tab and the project will continue building.";
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

  } catch (err: any) {
    console.error("Generate API error:", err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
