import { auth } from "@/auth";
import { db } from "@/db";
import { projects } from "@/db/schema/projects";
import { eq } from "drizzle-orm";
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

  // Map to serializable object
  const serializableProject = {
    id: project.id,
    name: project.name,
    status: project.status,
    selectedProvider: project.selectedProvider,
    selectedModel: project.selectedModel,
  };

  return <WorkspaceClient project={serializableProject} />;
}
