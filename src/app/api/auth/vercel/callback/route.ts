import { auth } from "@/auth";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema/settings";
import { eq, and } from "drizzle-orm";
import { encryptKey } from "@/lib/encryption";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const configurationId = url.searchParams.get("configurationId");
  const teamId = url.searchParams.get("teamId");
  const nextParam = url.searchParams.get("next");

  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    console.error("Vercel OAuth Error:", error, errorDescription);
    return new Response(`Vercel OAuth Error: ${error} - ${errorDescription || "Unknown error"}`, { status: 400 });
  }

  if (!code) {
    return new Response("Missing code parameter", { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    // Redirect to login and then return here to process the code
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/login?callbackUrl=${encodeURIComponent(req.url)}`,
      },
    });
  }

  const clientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  const clientSecret = process.env.VERCEL_APP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response("Vercel OAuth credentials not configured", { status: 500 });
  }

  const redirectUri = `${process.env.AUTH_URL || "https://aibuilderstudio.vercel.app"}/api/auth/vercel/callback`;
  const tokenEndpoint = "https://api.vercel.com/v2/oauth/access_token";

  // Safe server-side logging
  const maskedClientId = clientId.length > 10 ? `${clientId.substring(0, 6)}...${clientId.substring(clientId.length - 4)}` : "too-short";
  console.log("Vercel OAuth Token Exchange Debug:");
  console.log("- NEXT_PUBLIC_VERCEL_APP_CLIENT_ID exists:", !!clientId);
  console.log("- Masked Client ID:", maskedClientId);
  console.log("- VERCEL_APP_CLIENT_SECRET exists:", !!clientSecret);
  console.log("- token endpoint:", tokenEndpoint);
  console.log("- redirect_uri:", redirectUri);
  console.log("- authentication method: HTTP Basic Header");

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code: code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const { encryptedKey: encryptedAccessToken, iv: accessIv } = encryptKey(data.access_token);
      
      await db.delete(userIntegrations).where(
        and(eq(userIntegrations.userId, session.user.id), eq(userIntegrations.provider, "vercel"))
      );
      
      await db.insert(userIntegrations).values({
        userId: session.user.id,
        provider: "vercel",
        providerAccountId: data.user_id || "vercel_user",
        encryptedAccessToken,
        accessIv,
      });

      // Redirect to the Configuration URL UI if configurationId exists (Marketplace install)
      // Otherwise, redirect to the Dashboard Settings (In-app connection)
      const redirectUrl = new URL(
        configurationId ? "/vercel/configure" : "/dashboard/settings",
        process.env.AUTH_URL || "https://aibuilderstudio.vercel.app"
      );
      
      if (configurationId) redirectUrl.searchParams.set("configurationId", configurationId);
      if (teamId) redirectUrl.searchParams.set("teamId", teamId);
      if (nextParam) redirectUrl.searchParams.set("next", nextParam);
      
      return new Response(null, {
        status: 302,
        headers: {
          Location: redirectUrl.toString(),
        },
      });
    } else {
      const err = await response.text();
      console.error("Vercel OAuth Error:", err);
      return new Response(`Failed to exchange token: ${err}`, { status: 400 });
    }
  } catch (e) {
    console.error("Failed to exchange Vercel code:", e);
    return new Response("Internal Server Error during token exchange", { status: 500 });
  }
}
