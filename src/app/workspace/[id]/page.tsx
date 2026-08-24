import { auth } from "@/auth";
import { db } from "@/db";
import { projects, projectMessages } from "@/db/schema/projects";
import { eq, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { WorkspaceClient } from "./WorkspaceClient";

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) return notFound();
  
  // Authorization: Only owner can access
  if (project.userId !== session.user.id) return notFound();

  // Load previous conversation history
  const dbMessages = await db.query.projectMessages.findMany({
    where: eq(projectMessages.projectId, id),
    orderBy: [asc(projectMessages.createdAt)],
  });

  // Map to serializable objects
  const serializableProject = {
    id: project.id,
    name: project.name,
    status: project.status,
    selectedProvider: project.selectedProvider,
    selectedModel: project.selectedModel,
  };

  const serializableMessages = dbMessages.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  }));

  return <WorkspaceClient project={serializableProject} initialMessages={serializableMessages} />;
}
