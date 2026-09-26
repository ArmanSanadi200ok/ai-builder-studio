import { auth } from "@/auth";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema/settings";
import { projects, projectVersions, projectFiles } from "@/db/schema/projects";
import { eq, and } from "drizzle-orm";
import { decryptKey } from "@/lib/encryption";

export async function POST(req: Request) {
  console.log("[Diagnostics Backend] /api/deploy route entered");
  try {
    const session = await auth();
    console.log("[Diagnostics Backend] Authenticated user:", !!session?.user?.id);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { projectId } = await req.json();
    console.log("[Diagnostics Backend] Project ID requested:", projectId);
    if (!projectId) {
      return new Response("Missing projectId", { status: 400 });
    }

    const integration = await db.query.userIntegrations.findFirst({
      where: and(
        eq(userIntegrations.userId, session.user.id),
        eq(userIntegrations.provider, "vercel")
      )
    });

    if (!integration) {
      return new Response("Connect your Vercel integration in Settings before deploying.", { status: 400 });
    }

    let token: string;
    try {
      token = decryptKey(integration.encryptedAccessToken, integration.accessIv);
    } catch (e) {
      return new Response("Failed to decrypt Vercel token. Please reconnect Vercel in settings.", { status: 401 });
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId)
    });

    console.log("[Diagnostics Backend] Project found:", !!project);
    if (project) {
       console.log("[Diagnostics Backend] Project Status:", project.status);
       console.log("[Diagnostics Backend] Project ApplicationType:", project.applicationType);
    }

    if (!project) {
      return new Response("Project not found", { status: 404 });
    }

    // Get the latest version
    const latestVersion = await db.query.projectVersions.findFirst({
      where: eq(projectVersions.projectId, projectId),
      orderBy: (versions, { desc }) => [desc(versions.versionNumber)]
    });

    if (!latestVersion) {
      return new Response("Project has no versions to deploy", { status: 404 });
    }

    const files = await db.query.projectFiles.findMany({
      where: eq(projectFiles.versionId, latestVersion.id)
    });
    
    console.log("[Diagnostics Backend] ProjectFiles count:", files?.length || 0);

    if (!files || files.length === 0) {
      return new Response("No files found", { status: 404 });
    }

    // Prepare files for Vercel Deployments API
    const vercelFiles = files.map((f: { path: string; content: string }) => ({
      file: f.path,
      data: f.content
    }));

    // Framework Detection
    let detectedFramework: string | null = null;
    let hasPackageJson = false;
    let hasNextDependency = false;
    let hasViteDependency = false;
    
    const packageJsonFile = files.find((f: { path: string; content: string }) => f.path === "package.json" || f.path === "/package.json");
    if (packageJsonFile) {
        hasPackageJson = true;
        try {
            const pkg = JSON.parse(packageJsonFile.content);
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            if (deps.next) {
                hasNextDependency = true;
                detectedFramework = "nextjs";
            } else if (deps.vite) {
                hasViteDependency = true;
                detectedFramework = "vite";
            } else {
                detectedFramework = null; // default Node or other
            }
        } catch (e) {
            console.error("Failed to parse package.json for framework detection");
        }
    } else {
        // No package.json, assume static html
        detectedFramework = null;
    }

    const baseName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);
    const shortId = project.id.split('-')[0];
    const generatedProjectName = `${baseName}-${shortId}`.replace(/-+$/, '');
    const teamId = integration.teamId;
    const teamQuery = teamId ? `?teamId=${teamId}` : "";

    console.log("Vercel Deploy API Debug (Integration Flow):");
    console.log("- credential source/type: Vercel Integration Access Token");
    console.log(`- teamId context: ${teamId || "Personal Account"}`);
    console.log(`- detected framework: ${detectedFramework || "STATIC_HTML"}`);
    console.log(`- package.json: ${hasPackageJson}`);
    console.log(`- next dependency: ${hasNextDependency}`);
    console.log(`- file manifest count: ${vercelFiles.length}`);

    console.log("[Diagnostics Backend] ABS Project ID:", project.id);
    console.log("[Diagnostics Backend] Generated Vercel project name:", generatedProjectName);
    console.log("[Diagnostics Backend] Stored Vercel project ID:", project.vercelProjectId || "None");

    let targetVercelProjectId = project.vercelProjectId;
    let deployProjectName = generatedProjectName;

    if (!targetVercelProjectId) {
      // 1. Create Project
      console.log("[Diagnostics Backend] create-project request started to Vercel API (creating new)");
      const createProjectEndpoint = `https://api.vercel.com/v9/projects${teamQuery}`;
      const projectRes = await fetch(createProjectEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: generatedProjectName,
          framework: detectedFramework,
        }),
      });

      if (!projectRes.ok) {
        const err = await projectRes.json();
        console.log("[Diagnostics Backend] create-project HTTP status:", projectRes.status, "Error:", err.error?.code);
        
        if (projectRes.status === 409) {
          return new Response(`Vercel Project Creation Conflict: The name '${generatedProjectName}' is already taken on Vercel. Please rename your project or try again.`, { status: 409 });
        }
        
        console.log("- sanitized Vercel project creation error body:", JSON.stringify(err.error));
        return new Response(`Vercel Project Creation Error: ${err.error?.message || "Unknown error"}`, { status: 500 });
      }

      console.log("[Diagnostics Backend] create-project HTTP status:", projectRes.status, "(Success)");
      const projectData = await projectRes.json();
      targetVercelProjectId = projectData.id;
      
      await db.update(projects).set({ vercelProjectId: targetVercelProjectId }).where(eq(projects.id, projectId));
    } else {
      console.log("[Diagnostics Backend] Reusing existing Vercel Project ID:", targetVercelProjectId);
      // Fetch current Vercel project name to ensure we deploy to the correct project
      const projCheck = await fetch(`https://api.vercel.com/v9/projects/${targetVercelProjectId}${teamQuery}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (projCheck.ok) {
        const pd = await projCheck.json();
        deployProjectName = pd.name;
        console.log("[Diagnostics Backend] Retrieved current Vercel project name:", deployProjectName);
      } else {
        console.log("[Diagnostics Backend] Failed to fetch existing Vercel project details. Status:", projCheck.status);
      }
    }

    // 2. Start deployment
    console.log("[Diagnostics Backend] deployment request started to Vercel API");
    const vercelEndpoint = `https://api.vercel.com/v13/deployments${teamQuery}`;
    const vercelRes = await fetch(vercelEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: deployProjectName,
        projectSettings: {
          framework: detectedFramework
        },
        files: vercelFiles,
      }),
    });

    console.log("[Diagnostics Backend] deployment HTTP status:", vercelRes.status);
    console.log("- HTTP status:", vercelRes.status);

    if (!vercelRes.ok) {
      const err = await vercelRes.json();
      console.log("- sanitized Vercel error body:", JSON.stringify(err.error));
      return new Response(`Vercel Deploy Error: ${err.error?.message || "Unknown error"}`, { status: 500 });
    }

    const deployData = await vercelRes.json();
    console.log("[Diagnostics Backend] Deployment Status:", deployData.readyState || "QUEUED");

    // Update project status to deployed and save deploy URL
    await db.update(projects).set({ 
      status: "deployed", 
      vercelDeployUrl: deployData.url,
      updatedAt: new Date() 
    }).where(eq(projects.id, projectId));

    return new Response(JSON.stringify({ url: deployData.url }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(`Deploy error: ${err.message}`, { status: 500 });
  }
}
