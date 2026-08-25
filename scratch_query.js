const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  console.log('=== LATEST PROJECT FORENSICS ===');
  const projects = await sql\SELECT id, name, status, "createdAt" FROM project ORDER BY "createdAt" DESC LIMIT 1\;
  
  if (projects.length === 0) {
    console.log('No projects found in database.');
    return;
  }
  const project = projects[0];
  console.log('1. LATEST PROJECT:', project);
  
  const projectId = project.id;
  
  console.log('\n2. PROJECT MESSAGES:');
  const msgs = await sql\SELECT role, content, "createdAt" FROM project_message WHERE "projectId" = \ ORDER BY "createdAt" ASC\;
  if (msgs.length === 0) console.log('  No messages found.');
  msgs.forEach(m => console.log(\  [\] \...\));
  
  console.log('\n3. PROJECT JOBS:');
  const jobs = await sql\SELECT id, status, "currentStep", "errorMessage", "createdAt" FROM project_job WHERE "projectId" = \ ORDER BY "createdAt" DESC\;
  if (jobs.length === 0) console.log('  No jobs found.');
  jobs.forEach(j => console.log(\  Job \: status=\, currentStep=\, err=\\));
  
  console.log('\n4. PROJECT VERSIONS:');
  const versions = await sql\SELECT id, "versionNumber", "createdAt" FROM project_version WHERE "projectId" = \ ORDER BY "versionNumber" DESC\;
  if (versions.length === 0) console.log('  No versions found.');
  versions.forEach(v => console.log(\  Version \ (ID: \)\));
  
  if (versions.length > 0) {
    console.log('\n5. PROJECT FILES (Latest Version):');
    const files = await sql\SELECT path FROM project_file WHERE "versionId" = \\;
    if (files.length === 0) console.log('  No files found.');
    files.forEach(f => console.log(\  - \\));
  }
}

main().catch(console.error);
