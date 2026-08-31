import { auth } from "@/auth";
import { db } from "@/db";
import { projectJobs, projects } from "@/db/schema/projects";
import { eq, and } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { projectId } = await req.json();
    if (!projectId) {
      return new Response("Missing projectId", { status: 400 });
    }

    // Verify ownership and find active job
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    });

    if (!project) {
      return new Response("Project not found", { status: 404 });
    }

    const activeJob = await db.query.projectJobs.findFirst({
      where: and(
        eq(projectJobs.projectId, projectId),
        eq(projectJobs.status, "GENERATING")
      ),
    });

    if (!activeJob) {
      return new Response("No active generation found to stop", { status: 400 });
    }

    // Mark Job and Project as CANCELLED explicitly
    await db.update(projectJobs).set({ 
      status: "CANCELLED",
      errorMessage: "Generation stopped",
      completedAt: new Date()
    }).where(eq(projectJobs.id, activeJob.id));

    // Update project status to 'cancelled' so UI knows it stopped
    await db.update(projects).set({ 
      status: "cancelled" 
    }).where(eq(projects.id, projectId));

    // Send cancellation event to Inngest
    await inngest.send({
      name: "project/generation.cancel-requested",
      data: {
        projectId: project.id
      }
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Stop generation error:", err);
    return new Response("Unable to stop this generation. Please try again.", { status: 500 });
  }
}
