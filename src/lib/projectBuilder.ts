import { db } from "@/db";
import { projectFiles } from "@/db/schema/projects";
import { eq } from "drizzle-orm";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function preflightBuild(versionId: string): Promise<{ success: boolean; error?: string; framework: string }> {
  const files = await db.query.projectFiles.findMany({
    where: eq(projectFiles.versionId, versionId)
  });

  if (!files || files.length === 0) {
    return { success: false, error: "No files to build", framework: "none" };
  }

  // Framework Detection
  let detectedFramework = "STATIC_HTML";
  const packageJsonFile = files.find(f => f.path === "package.json" || f.path === "/package.json");
  
  if (packageJsonFile) {
      try {
          const pkg = JSON.parse(packageJsonFile.content);
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          if (deps.next) {
              detectedFramework = "NEXT_JS";
          } else if (deps.vite) {
              detectedFramework = "VITE";
          } else {
              detectedFramework = "OTHER_NODE";
          }
          
          if (!pkg.scripts || !pkg.scripts.build) {
              // If there's no build script, treat it as success since we can't run build.
              return { success: true, framework: detectedFramework };
          }
      } catch {
          console.error("Failed to parse package.json for build preflight");
      }
  } else {
      // No package.json -> static html, no build required.
      return { success: true, framework: "STATIC_HTML" };
  }

  // We need to build.
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'abs-build-'));
  
  try {
    // Write all files
    for (const file of files) {
      const filePath = path.join(tmpDir, file.path.replace(/^\//, ''));
      const dirPath = path.dirname(filePath);
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(filePath, file.content, "utf8");
    }

    // Run npm install
    await execAsync('npm install --no-fund --no-audit', { cwd: tmpDir, timeout: 60000 });
    
    // Run npm run build
    await execAsync('npm run build', { cwd: tmpDir, timeout: 60000 });
    
    return { success: true, framework: detectedFramework };
  } catch (error: unknown) {
    const eObj = error as { message?: string, stdout?: string, stderr?: string };
    let errorMsg = eObj.message || String(error);
    if (eObj.stdout) errorMsg += `\nStdout:\n${eObj.stdout}`;
    if (eObj.stderr) errorMsg += `\nStderr:\n${eObj.stderr}`;
    
    return { success: false, error: errorMsg, framework: detectedFramework };
  } finally {
    // Cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      console.error("Failed to cleanup temp directory");
    }
  }
}
