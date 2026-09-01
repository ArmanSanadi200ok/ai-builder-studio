import { db } from "@/db";
import { projectVersions, projectFiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  try {
    const version = await db.query.projectVersions.findFirst({
      where: eq(projectVersions.projectId, params.id),
      orderBy: [desc(projectVersions.versionNumber)],
    });

    if (!version) return Response.json({ files: [] });

    const files = await db.query.projectFiles.findMany({
      where: eq(projectFiles.versionId, version.id),
    });

    return Response.json({ files: files.map(f => ({ path: f.path, content: f.content })) });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
