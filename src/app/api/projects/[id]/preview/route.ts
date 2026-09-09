import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema/projects";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { inngest } from "@/inngest/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await inngest.send({
    name: "project/preview.requested",
    data: { projectId, userId: session.user.id },
  });

  return NextResponse.json({ status: "CREATING_SANDBOX" }, { status: 202 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    previewStatus: project.previewStatus,
    previewUrl: project.previewUrl,
    previewError: project.previewError,
  });
}
