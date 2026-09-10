import { Sandbox } from '@vercel/sandbox';
import { db } from "@/db";
import { projectFiles } from "@/db/schema/projects";
import { eq } from "drizzle-orm";

export async function getProjectFiles(versionId: string) {
  return await db.query.projectFiles.findMany({
    where: eq(projectFiles.versionId, versionId)
  });
}

export async function createOrResumeSandbox(projectId: string) {
  const sandboxName = `abs-project-${projectId}`;
  console.log(`Getting or creating sandbox: ${sandboxName}`);
  
  const credentials = process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID ? {
    token: process.env.VERCEL_TOKEN,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID
  } : undefined;

  // getOrCreate ensures we resume if it exists
  const sandbox = await Sandbox.getOrCreate({ 
    name: sandboxName, 
    ports: [3000, 5173],
    ...credentials 
  });
  return sandbox;
}

export async function syncFilesToSandbox(sandbox: Sandbox, files: { path: string, content: string }[]) {
  const sandboxFiles = files.map(file => {
    let content = file.content;
    const pathLower = file.path.toLowerCase();
    
    // Inject allowedHosts for Vite to prevent 403 Forbidden on the preview URL
    if (pathLower === "vite.config.js" || pathLower === "vite.config.ts") {
      if (content.includes("defineConfig({")) {
        content = content.replace("defineConfig({", "defineConfig({ server: { allowedHosts: true },");
      } else if (content.includes("export default {")) {
        content = content.replace("export default {", "export default { server: { allowedHosts: true },");
      }
    }
    
    return {
      path: file.path.startsWith('/') ? file.path.substring(1) : file.path,
      content
    };
  });
  
  // If Vite project and no config exists, add one
  const hasViteConfig = sandboxFiles.some(f => f.path.toLowerCase() === 'vite.config.js' || f.path.toLowerCase() === 'vite.config.ts');
  const isVite = files.some(f => f.path.toLowerCase() === 'package.json' && f.content.includes('"vite"'));
  if (isVite && !hasViteConfig) {
    sandboxFiles.push({
      path: 'vite.config.js',
      content: `export default { server: { allowedHosts: true } };`
    });
  }
  
  await sandbox.writeFiles(sandboxFiles);
  return sandboxFiles;
}

export function detectPackageManager(files: { path: string }[]) {
  const filePaths = files.map(f => f.path.toLowerCase());
  if (filePaths.includes("pnpm-lock.yaml")) return "pnpm";
  if (filePaths.includes("yarn.lock")) return "yarn";
  if (filePaths.includes("bun.lockb")) return "bun";
  return "npm"; // Default
}

export function detectProjectFramework(files: { path: string, content: string }[]) {
  const packageJsonFile = files.find(f => f.path.toLowerCase() === "package.json");
  if (!packageJsonFile) return "static";
  
  try {
    const pkg = JSON.parse(packageJsonFile.content);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (deps["next"]) return "next";
    if (deps["vite"]) return "vite";
    if (deps["react-scripts"]) return "cra";
    
    return "node";
  } catch(e) {
    return "static";
  }
}

export function getDevCommand(packageManager: string, framework: string, files: { path: string, content: string }[]) {
  const packageJsonFile = files.find(f => f.path.toLowerCase() === "package.json");
  let hasDevScript = false;
  let hasStartScript = false;
  
  if (packageJsonFile) {
    try {
      const pkg = JSON.parse(packageJsonFile.content);
      if (pkg.scripts?.dev) hasDevScript = true;
      if (pkg.scripts?.start) hasStartScript = true;
    } catch(e) {}
  }

  // Bind to 0.0.0.0
  if (framework === "vite") {
    return `${packageManager} run dev -- --host 0.0.0.0`;
  }
  
  if (framework === "next") {
    return `${packageManager} run dev -- -H 0.0.0.0`;
  }
  
  if (framework === "cra") {
    return `HOST=0.0.0.0 ${packageManager} run start`;
  }
  
  if (hasDevScript) {
    return `${packageManager} run dev`;
  }
  
  if (hasStartScript) {
    return `${packageManager} run start`;
  }
  
  if (framework === "static") {
    // If it's just static HTML, use python or npx serve
    return `npx serve -p 3000 -l 0.0.0.0`;
  }
  
  return `npx serve -p 3000 -l 0.0.0.0`;
}
