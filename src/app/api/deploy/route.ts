import { auth } from "@/auth";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema/settings";
import { projects, projectVersions, projectFiles } from "@/db/schema/projects";
import { eq, and } from "drizzle-orm";
import { decryptKey } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { projectId } = await req.json();
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

    if (!files || files.length === 0) {
      return new Response("No files found", { status: 404 });
    }

    // Prepare files for Vercel Deployments API
    const vercelFiles = files.map((f: { path: string; content: string }) => ({
      file: f.path,
      data: f.content
    }));

    const projectName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 52);
    const teamId = integration.teamId;
    const teamQuery = teamId ? `?teamId=${teamId}` : "";

    console.log("Vercel Deploy API Debug (Integration Flow):");
    console.log("- credential source/type: Vercel Integration Access Token");
    console.log(`- teamId context: ${teamId || "Personal Account"}`);

    // 1. Create Project
    const createProjectEndpoint = `https://api.vercel.com/v9/projects${teamQuery}`;
    const projectRes = await fetch(createProjectEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        framework: "nextjs",
      }),
    });

    if (!projectRes.ok) {
      const err = await projectRes.json();
      // 409 means project already exists, which is fine
      if (projectRes.status !== 409) {
        console.log("- sanitized Vercel project creation error body:", JSON.stringify(err.error));
        return new Response(`Vercel Project Creation Error: ${err.error?.message || "Unknown error"}`, { status: 500 });
      }
    }

    // 2. Start deployment
    const vercelEndpoint = `https://api.vercel.com/v13/deployments${teamQuery}`;
    const vercelRes = await fetch(vercelEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        projectSettings: {
          framework: "nextjs"
        },
        files: vercelFiles,
      }),
    });

    console.log("- HTTP status:", vercelRes.status);

    if (!vercelRes.ok) {
      const err = await vercelRes.json();
      console.log("- sanitized Vercel error body:", JSON.stringify(err.error));
      return new Response(`Vercel Deploy Error: ${err.error?.message || "Unknown error"}`, { status: 500 });
    }

    const deployData = await vercelRes.json();

    // Update project status to deployed
    await db.update(projects).set({ status: "deployed", updatedAt: new Date() }).where(eq(projects.id, projectId));

    return new Response(JSON.stringify({ url: deployData.url }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(`Deploy error: ${err.message}`, { status: 500 });
  }
}
