import { db } from "./src/db";
import { projects, projectJobs } from "./src/db/schema/projects";
import { inngest } from "./src/inngest/client";

async function run() {
  const userId = "6af50d20-9d8e-4716-97d7-33a45a2c237b"; // From previous trace
  
  // Create project
  const [project] = await db.insert(projects).values({
    userId,
    name: "Todo Test",
    description: "Build a Todo app with add, edit, complete and delete functionality.",
    status: "draft",
    selectedProvider: "openrouter",
    selectedModel: "poolside/laguna-xs-2.1:free"
  }).returning();

  // Create job
  const [job] = await db.insert(projectJobs).values({
    projectId: project.id,
    userId,
    initialPrompt: "Build a Todo app with add, edit, complete and delete functionality.",
    status: "PENDING",
    selectedProvider: "openrouter",
    selectedModel: "poolside/laguna-xs-2.1:free",
    currentStep: "Initializing job"
  }).returning();

  console.log(`Triggering Inngest generation for Project ${project.id}, Job ${job.id}`);
  
  await inngest.send({
    name: "project/generate.requested",
    data: {
      projectId: project.id,
      jobId: job.id
    }
  });
  
  console.log("Triggered successfully. Check DB for job status soon.");
  process.exit(0);
}

run().catch(console.error);
