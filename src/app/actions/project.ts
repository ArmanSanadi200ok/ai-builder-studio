"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { projects } from "@/db/schema/projects";
import { redirect } from "next/navigation";

export async function createProjectDraft(data: {
  name: string;
  description: string;
  provider: string;
  model?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("You must be logged in to create a project.");
  }

  if (!data.name || data.name.trim().length === 0) {
    throw new Error("Project name is required.");
  }

  const [newProject] = await db.insert(projects).values({
    userId: session.user.id,
    name: data.name,
    description: data.description,
    selectedProvider: data.provider,
    selectedModel: data.model,
    status: "draft",
  }).returning();

  return { success: true, projectId: newProject.id };
}
