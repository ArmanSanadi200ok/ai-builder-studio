import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../src/db";
import { projects, projectJobs } from "../src/db/schema/projects";
import { inngest } from "../src/inngest/client";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function runE2E() {
  console.log("=== STARTING GENERATION E2E ===");
  const userId = "6af50d20-9d8e-4716-97d7-33a45a2c237b"; // User with Groq/OpenRouter keys

  const projectId = crypto.randomUUID();
  const prompt = "Create a simple React + Vite + TypeScript todo application with add, complete, delete, and filter functionality. Use React, TypeScript, Vite, and standard CSS only. No backend, authentication, external APIs, external images, or UI libraries.";

  console.log(`Creating project ${projectId}...`);
  await db.insert(projects).values({
    id: projectId,
    userId: userId,
    name: "E2E Todo App",
    description: prompt,
    status: "generating",
    selectedProvider: "openrouter",
    selectedModel: "openai/gpt-4o-mini",
  });

  console.log("Sending project/generate.requested event to Inngest...");
  await inngest.send({
    name: "project/generate.requested",
    data: {
      projectId,
      userId,
      prompt,
      mode: "creation"
    }
  });

  console.log("Waiting for project to become ready (this may take a few minutes)...");
  
  let finalProject;
  let finalJob;
  
  while (true) {
    const proj = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    
    const projJobs = await db.query.projectJobs.findMany({
      where: eq(projectJobs.projectId, projectId),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
      limit: 1
    });
    
    if (proj?.status === "ready" || proj?.status === "failed") {
      finalProject = proj;
      finalJob = projJobs[0];
      break;
    }

    if (projJobs[0]) {
       console.log(`Status: ${proj?.status} | Job: ${projJobs[0].status} | Step: ${projJobs[0].currentStep}`);
    }

    await new Promise(r => setTimeout(r, 10000));
  }

  console.log("\n=== E2E RESULT ===");
  console.log("Final Project Status:", finalProject.status);
  console.log("ProjectId:", finalProject.id);
  console.log("JobId:", finalJob?.id);
  console.log("Repair Count:", finalJob?.repairCount);
  console.log("SandboxId:", finalProject.sandboxId);
  console.log("SandboxName:", finalProject.sandboxName);
  console.log("PreviewUrl:", finalProject.previewUrl);
  console.log("PreviewStatus:", finalProject.previewStatus);
  console.log("ValidatedVersionId:", finalProject.validatedVersionId);
  console.log("RuntimeTest Result:", finalProject.previewStatus === "READY" && finalProject.validatedVersionId ? "PASSED" : "FAILED/SKIPPED");
  console.log("FinalReview Result:", finalProject.validatedVersionId ? "PASSED" : "FAILED");
  
  if (finalProject.status === "ready") {
    console.log("✅ GENERATION PASSED");
  } else {
    console.log("❌ GENERATION FAILED");
    console.log("Job Error:", finalJob?.errorMessage);
  }
}

runE2E().catch(console.error).finally(() => process.exit(0));
