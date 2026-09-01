import { db } from "./src/db";
import { projectJobs, projects } from "./src/db/schema/projects";
import { desc, eq, like } from "drizzle-orm";

async function run() {
  const p = await db.query.projects.findMany({
    where: like(projects.description, "%Todo%"),
    orderBy: [desc(projects.createdAt)],
    limit: 5
  });
  
  console.log("Projects matching Todo:", JSON.stringify(p, null, 2));
  
  for (const proj of p) {
    const jobs = await db.query.projectJobs.findMany({
      where: eq(projectJobs.projectId, proj.id),
      orderBy: [desc(projectJobs.createdAt)]
    });
    console.log(`Jobs for project ${proj.id}:`, JSON.stringify(jobs, null, 2));
  }
  
  process.exit(0);
}
run().catch(console.error);
