import { auth } from "@/auth";
import { db } from "@/db";
import { projectJobs } from "@/db/schema/projects";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { id: projectId } = await params;
    if (!projectId) return new Response("Missing project id", { status: 400 });

    const latestJob = await db.query.projectJobs.findFirst({
      where: and(eq(projectJobs.projectId, projectId), eq(projectJobs.userId, session.user.id)),
      orderBy: [desc(projectJobs.createdAt)],
    });

    if (!latestJob) {
      return new Response(JSON.stringify({ job: null }), { status: 200 });
    }

    return new Response(JSON.stringify({ job: latestJob }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Fetch job error:", err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
