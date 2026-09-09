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
        
        await syncFilesToSandbox(sandbox, files);
        
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

          const installResult = await sandbox.runCommand(packageManager, ["install"]);
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

        const devCommand = getDevCommand(packageManager, framework, files);
        
        // Background the dev server
        await sandbox.runCommand("sh", ["-c", `nohup ${devCommand} > /workspace/server.log 2>&1 &`]);
        
        // Wait briefly to ensure it starts
        await new Promise(r => setTimeout(r, 2000));
        
        // Expose port
        const targetPort = framework === "vite" ? 5173 : 3000;
        
        const previewUrl = await sandbox.domain(targetPort);
        
        // Health check logic would go here (polling the url)
        
        await db.update(projects).set({ 
          previewStatus: "READY",
          previewUrl,
          previewPort: targetPort,
          lastPreviewedAt: new Date()
        }).where(eq(projects.id, projectId));
      });

    } catch (error: any) {
      await step.run("handle-error", async () => {
        await db.update(projects).set({ 
          previewStatus: "FAILED",
          previewError: error.message || String(error)
        }).where(eq(projects.id, projectId));
      });
    }
  }
);
