import { db } from "./src/db";
import { projectJobs } from "./src/db/schema/projects";
import { eq } from "drizzle-orm";

async function run() {
  const jobId = process.argv[2];
  if (!jobId) throw new Error("Pass job ID");
  const job = await db.query.projectJobs.findFirst({
    where: eq(projectJobs.id, jobId)
  });
  console.log(JSON.stringify(job, null, 2));
  process.exit(0);
}
run().catch(console.error);
