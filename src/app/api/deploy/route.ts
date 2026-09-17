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

    // Start deployment
    const vercelEndpoint = "https://api.vercel.com/v13/deployments";

    const maskedPrefix = token.startsWith('vca_') ? 'vca_***' : token.startsWith('vci_') ? 'vci_***' : 'other_***';
    
    console.log("Vercel Deploy API Debug:");
    console.log("- credential source/type: OAuth Access Token from userIntegrations");
    console.log(`- masked token prefix: ${maskedPrefix}`);
    console.log(`- token validity/expiry handling: None currently implemented in deploy route. Token may be expired if short-lived.`);
    console.log(`- refresh token stored: ${!!integration.encryptedRefreshToken}`);
    console.log("- endpoint URL:", vercelEndpoint);
    console.log("- HTTP method: POST");
    console.log("- teamId/ownership context: None explicitly passed, defaults to personal account");

    const vercelRes = await fetch(vercelEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 52),
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
