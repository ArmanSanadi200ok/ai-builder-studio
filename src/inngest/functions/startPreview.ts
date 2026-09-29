import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { projects, projectVersions } from "@/db/schema/projects";
import { eq, desc } from "drizzle-orm";
import { 
  getProjectFiles, 
  createOrResumeSandbox, 
  syncFilesToSandbox, 
  detectPackageManager, 
  detectProjectFramework, 
  getDevCommand 
} from "@/lib/preview/sandbox";

function getProjectRootDir(files: { path: string }[]): string {
  const rootFiles = ['package.json', 'index.html'];
  for (const rootFile of rootFiles) {
    const file = files.find(f => f.path.toLowerCase().endsWith(rootFile));
    if (file) {
      let dir = file.path.substring(0, file.path.length - rootFile.length);
      dir = dir.replace(/^\/+/, '').replace(/\/+$/, '');
      return dir;
    }
  }
  return '';
}

async function safeSandboxOperation<T>(sandbox: { name?: string; delete?: () => Promise<void> } | unknown, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    if (errorMsg.includes('SANDBOX_STOPPED') || errorMsg.includes('410')) {
      const sbName = (sandbox as { name?: string })?.name || 'unknown';
      console.log(`[Preview] Detected unrecoverable sandbox ${sbName}. Deleting to allow recreation.`);
      try { await (sandbox as { delete?: () => Promise<void> })?.delete?.(); } catch {}
      throw new Error(`Sandbox ${sbName} was unrecoverable and has been deleted. Inngest will retry and create a fresh one.`);
    }
    throw e;
  }
}

export const startPreviewSandbox = inngest.createFunction(
  { 
    id: "start-preview-sandbox",
    name: "Start Preview Sandbox",
    triggers: [{ event: "project/preview.requested" }],
    cancelOn: [
      {
        event: "project/preview.cancel",
        match: "data.projectId",
      }
    ],
  },
  async ({ event, step }) => {
    const { projectId, userId } = event.data;

    // 1. Verify project exists and belongs to user
    const project = await step.run("verify-project", async () => {
      const proj = await db.query.projects.findFirst({
        where: eq(projects.id, projectId)
      });
      if (!proj || proj.userId !== userId) {
        throw new Error("Project not found or unauthorized");
      }
      
      // If mobile app, bypass sandbox
      if (proj.applicationType === "MOBILE_APP") {
        await db.update(projects).set({ 
          previewStatus: "READY",
          previewError: null
        }).where(eq(projects.id, projectId));
        return proj;
      }
      
      // Update status to CREATING_SANDBOX
      await db.update(projects).set({ 
        previewStatus: "CREATING_SANDBOX",
        previewError: null
      }).where(eq(projects.id, projectId));
      
      return proj;
    });

    if (project.applicationType === "MOBILE_APP") {
      return { status: "skipped", reason: "Mobile app preview bypass" };
    }

    // 2. Fetch latest project version and files
    const files = await step.run("fetch-files", async () => {
      const latestVersion = await db.query.projectVersions.findFirst({
        where: eq(projectVersions.projectId, projectId),
        orderBy: [desc(projectVersions.versionNumber)],
      });
      
      if (!latestVersion) throw new Error("No files found for project");
      
      const projectFiles = await getProjectFiles(latestVersion.id);
      return projectFiles;
    });

    try {
      // 3. Create or Resume Sandbox
      const sandboxInfo = await step.run("create-sandbox", async () => {
        const sandbox = await createOrResumeSandbox(projectId);
        
        await db.update(projects).set({ 
          previewStatus: "SYNCING_FILES",
          sandboxId: sandbox.name,
          sandboxName: sandbox.name
        }).where(eq(projects.id, projectId));
        
        return { id: sandbox.name, name: sandbox.name };
      });

      // 4. Sync Files
      const { packageManager, framework } = await step.run("sync-files", async () => {
        const { Sandbox } = await import('@vercel/sandbox');
        const credentials = process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID ? {
          token: process.env.VERCEL_TOKEN,
          teamId: process.env.VERCEL_TEAM_ID,
          projectId: process.env.VERCEL_PROJECT_ID
        } : undefined;
        const sandbox = await Sandbox.get({ name: sandboxInfo.name, ...credentials });
        if (!sandbox) throw new Error("Sandbox lost");
        
        await safeSandboxOperation(sandbox, async () => {
          await syncFilesToSandbox(sandbox, files);
        });
        
        const pm = detectPackageManager(files);
        const fw = detectProjectFramework(files);
        
        await db.update(projects).set({ 
          previewStatus: "INSTALLING" 
        }).where(eq(projects.id, projectId));
        
        return { packageManager: pm, framework: fw };
      });

      // 5. Install Dependencies (if not static)
      if (framework !== "static") {
        await step.run("install-dependencies", async () => {
          const { Sandbox } = await import('@vercel/sandbox');
          const credentials = process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID ? {
            token: process.env.VERCEL_TOKEN,
            teamId: process.env.VERCEL_TEAM_ID,
            projectId: process.env.VERCEL_PROJECT_ID
          } : undefined;
          const sandbox = await Sandbox.get({ name: sandboxInfo.name, ...credentials });
          if (!sandbox) throw new Error("Sandbox lost");

          const installResult = await safeSandboxOperation(sandbox, async () => {
             const projectRootDir = getProjectRootDir(files);
             const fullInstallCmd = projectRootDir ? `cd ${projectRootDir} && ${packageManager} install` : `${packageManager} install`;
             return await sandbox.runCommand({
               cmd: "sh",
               args: ["-c", fullInstallCmd]
             });
          });
          
          if (installResult.exitCode !== 0) {
            throw new Error(`Dependency installation failed:\n${installResult.stderr || installResult.stdout}`);
          }
        });
      }

      // 6. Start Dev Server
      await step.run("start-dev-server", async () => {
        const { Sandbox } = await import('@vercel/sandbox');
        const credentials = process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID ? {
          token: process.env.VERCEL_TOKEN,
          teamId: process.env.VERCEL_TEAM_ID,
          projectId: process.env.VERCEL_PROJECT_ID
        } : undefined;
        const sandbox = await Sandbox.get({ name: sandboxInfo.name, ...credentials });
        if (!sandbox) throw new Error("Sandbox lost");

        await db.update(projects).set({ 
          previewStatus: "STARTING" 
        }).where(eq(projects.id, projectId));

        const targetPort = framework === "vite" ? 5173 : 3000;
        
        let previewUrl = "";
        let isReady = false;
        
        // 1. Check if the process is ALREADY listening and healthy
        try {
          previewUrl = await safeSandboxOperation(sandbox, async () => sandbox.domain(targetPort));
          const res = await fetch(previewUrl);
          if (res.ok || res.status === 404 || res.status === 403) {
            isReady = true;
          }
        } catch {
          // Not ready
        }
        
        let devCmd: { wait: () => Promise<unknown>, stdout: () => Promise<string>, stderr: () => Promise<string> } | null = null;
        let crashResult: { exitCode?: number } | null = null;
        
        if (!isReady) {
          // Kill any dead/zombie process bound to the target port
          await safeSandboxOperation(sandbox, async () => {
            await sandbox.runCommand({ cmd: "sh", args: ["-c", `kill -9 $(lsof -t -i:${targetPort}) 2>/dev/null || true`] });
          });
          
          const projectRootDir = getProjectRootDir(files);
          const cwdPath = projectRootDir ? `/vercel/${projectRootDir}` : `/vercel`;
          
          console.log(`[Preview] Diagnostics for sandbox ${sandboxInfo.name}:`);
          console.log(`Preview root directory: ${projectRootDir || '/'}`);
          console.log(`Current working directory: ${cwdPath}`);
          console.log(`Project files synced: ${files.length}`);
          console.log(`package.json exists: ${files.some(f => f.path.toLowerCase().endsWith('package.json'))}`);
          console.log(`index.html exists: ${files.some(f => f.path.toLowerCase().endsWith('index.html'))}`);

          const devCommand = getDevCommand(packageManager, framework, files, targetPort);
          const fullCmd = projectRootDir ? `cd ${projectRootDir} && ${devCommand}` : devCommand;
          
          devCmd = await safeSandboxOperation(sandbox, async () => {
            return await sandbox.runCommand({
              cmd: "sh",
              args: ["-c", fullCmd],
              detached: true
            });
          });
          
          // Listen for early crashes
          devCmd?.wait().then((res: unknown) => { crashResult = res as { exitCode?: number }; }).catch(() => {});
          
          // Proper readiness check with retries
          for (let i = 0; i < 30; i++) {
            if (crashResult) {
              const stdout = await devCmd?.stdout().catch(() => "") || "";
              const stderr = await devCmd?.stderr().catch(() => "") || "";
              throw new Error(`Dev server crashed (Exit ${(crashResult as { exitCode?: number }).exitCode}):\n${stderr}\n${stdout}`);
            }
            
            try {
              previewUrl = await safeSandboxOperation(sandbox, async () => sandbox.domain(targetPort));
              const res = await fetch(previewUrl);
              // 200 OK, 404 Not Found (app is running but no index), 403 Forbidden (Vite host check) all mean the server is ALIVE.
              if (res.ok || res.status === 404 || res.status === 403) {
                isReady = true;
                break;
              }
            } catch (e: unknown) {
              const errorMsg = e instanceof Error ? e.message : String(e);
              if (errorMsg.includes('unrecoverable')) throw e; // Let the safeSandboxOperation error propagate
            }
            await new Promise(r => setTimeout(r, 1000));
          }
          
          if (!isReady) {
            const stdout = await devCmd?.stdout().catch(() => "") || "";
            const stderr = await devCmd?.stderr().catch(() => "") || "";
            throw new Error(`Dev server failed to become ready on port ${targetPort}.\nLogs:\n${stderr}\n${stdout}`);
          }
        }
        
        await db.update(projects).set({ 
          previewStatus: "READY",
          previewUrl,
          previewPort: targetPort,
          lastPreviewedAt: new Date()
        }).where(eq(projects.id, projectId));
      });

    } catch (error: unknown) {
      await step.run("handle-error", async () => {
        // If we threw our "unrecoverable" error, we do NOT want to mark it as FAILED if Inngest will retry it.
        // Wait, Inngest retries steps by default. If a step throws, it retries that step.
        // But if `create-sandbox` succeeded and `sync-files` threw, Inngest will retry `sync-files`!
        // If it retries `sync-files`, it calls `Sandbox.get()` and finds NO sandbox because we deleted it!
        // `Sandbox.get()` returning null causes `throw new Error("Sandbox lost")`.
        // Then it retries again, still lost.
        // To fix this, we should throw a NonRetriableError, and let the user click "Retry Preview".
        // BUT wait, Inngest has a feature to retry the whole function? No.
        // Let's just fail it with a clean message so the user clicks "Retry Preview". The next time, it will create a fresh one!
        let msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("was unrecoverable and has been deleted")) {
          msg = "Sandbox was in a stopped/unreachable state and has been reset. Please click Retry Preview to start a fresh environment.";
        }
        await db.update(projects).set({ 
          previewStatus: "FAILED",
          previewError: msg
        }).where(eq(projects.id, projectId));
      });
    }
  }
);
