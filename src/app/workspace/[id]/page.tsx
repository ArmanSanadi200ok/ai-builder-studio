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

  // Load active or latest job
  const { projectJobs } = await import("@/db/schema/projects");
  const { desc } = await import("drizzle-orm");
  const latestJob = await db.query.projectJobs.findFirst({
    where: eq(projectJobs.projectId, id),
    orderBy: [desc(projectJobs.createdAt)],
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

  const serializableJob = latestJob ? {
    id: latestJob.id,
    status: latestJob.status,
    currentStep: latestJob.currentStep,
    selectedProvider: latestJob.selectedProvider,
  } : null;

  return <WorkspaceClient project={serializableProject} initialMessages={serializableMessages} initialJob={serializableJob} />;
}
