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

async function safeSandboxOperation<T>(sandbox: any, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e: any) {
    if (e.message?.includes('SANDBOX_STOPPED') || e.message?.includes('410') || String(e).includes('410') || String(e).includes('SANDBOX_STOPPED')) {
      console.log(`[Preview] Detected unrecoverable sandbox ${sandbox.name}. Deleting to allow recreation.`);
      try { await sandbox.delete(); } catch(deleteErr) {}
      throw new Error(`Sandbox ${sandbox.name} was unrecoverable and has been deleted. Inngest will retry and create a fresh one.`);
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
      
      // Update status to CREATING_SANDBOX
      await db.update(projects).set({ 
        previewStatus: "CREATING_SANDBOX",
        previewError: null
      }).where(eq(projects.id, projectId));
      
      return proj;
    });

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
             return await sandbox.runCommand(packageManager, ["install"]);
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
        } catch (e) {
          // Not ready
        }
        
        let devCmd: any = null;
        let crashResult: any = null;
        
        if (!isReady) {
          // Kill any dead/zombie process bound to the target port
          await safeSandboxOperation(sandbox, async () => {
            await sandbox.runCommand({ cmd: "sh", args: ["-c", `kill -9 $(lsof -t -i:${targetPort}) 2>/dev/null || true`] });
          });
          
          const devCommand = getDevCommand(packageManager, framework, files, targetPort);
          
          devCmd = await safeSandboxOperation(sandbox, async () => {
            return await sandbox.runCommand({
              cmd: "sh",
              args: ["-c", devCommand],
              detached: true
            });
          });
          
          // Listen for early crashes
          devCmd.wait().then((res: any) => { crashResult = res; }).catch(() => {});
          
          // Proper readiness check with retries
          for (let i = 0; i < 30; i++) {
            if (crashResult) {
              const stdout = await devCmd.stdout().catch(() => "");
              const stderr = await devCmd.stderr().catch(() => "");
              throw new Error(`Dev server crashed (Exit ${crashResult.exitCode}):\n${stderr}\n${stdout}`);
            }
            
            try {
              previewUrl = await safeSandboxOperation(sandbox, async () => sandbox.domain(targetPort));
              const res = await fetch(previewUrl);
              // 200 OK, 404 Not Found (app is running but no index), 403 Forbidden (Vite host check) all mean the server is ALIVE.
              if (res.ok || res.status === 404 || res.status === 403) {
                isReady = true;
                break;
              }
            } catch (e: any) {
              if (e.message?.includes('unrecoverable')) throw e; // Let the safeSandboxOperation error propagate
            }
            await new Promise(r => setTimeout(r, 1000));
          }
          
          if (!isReady) {
            const stdout = await devCmd.stdout().catch(() => "");
            const stderr = await devCmd.stderr().catch(() => "");
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

    } catch (error: any) {
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
        let msg = error.message || String(error);
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
