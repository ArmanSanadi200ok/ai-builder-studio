const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  console.log('--- PROJECTS ---');
  const projects = await sql\SELECT id, name, status, "createdAt" FROM project ORDER BY "createdAt" DESC LIMIT 3\;
  console.log(projects);
  
  if (projects.length === 0) return;
  const projectId = projects[0].id;
  
  console.log('\n--- PROJECT JOBS ---');
  const jobs = await sql\SELECT id, "projectId", status, "currentStep", "errorMessage", "createdAt" FROM project_job WHERE "projectId" = \ ORDER BY "createdAt" DESC\;
  console.log(jobs);
  
  console.log('\n--- PROJECT MESSAGES ---');
  const msgs = await sql\SELECT role, content FROM project_message WHERE "projectId" = \ ORDER BY "createdAt" ASC\;
  console.log(msgs.map(m => m.role + ': ' + m.content.substring(0, 50)));
}
main().catch(console.error);
