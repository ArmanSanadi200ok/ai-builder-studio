import { auth } from "@/auth";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema/settings";
import { eq, and } from "drizzle-orm";
import { encryptKey } from "@/lib/encryption";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const configurationId = url.searchParams.get("configurationId");
  const teamId = url.searchParams.get("teamId");
  const nextParam = url.searchParams.get("next");
  const state = url.searchParams.get("state");
  const source = url.searchParams.get("source");

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

  const cookieStore = await cookies();
  const isIntegrationFlow = !!configurationId || source === "external";
  
  if (isIntegrationFlow) {
    // -------------------------------------------------------------
    // VERCEL INTEGRATION OAUTH FLOW
    // -------------------------------------------------------------
    const integrationState = cookieStore.get("vercel_integration_state")?.value;
    if (state && state !== integrationState) {
      return new Response("Invalid state parameter", { status: 400 });
    }

    const clientId = process.env.VERCEL_INTEGRATION_CLIENT_ID;
    const clientSecret = process.env.VERCEL_INTEGRATION_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new Response("Vercel Integration credentials not configured", { status: 500 });
    }

    const redirectUri = `${process.env.AUTH_URL || "https://aibuilderstudio.vercel.app"}/api/auth/vercel/callback`;
    const tokenEndpoint = "https://api.vercel.com/v2/oauth/access_token";

    const maskedClientId = clientId && clientId.length > 10 ? `${clientId.substring(0, 6)}...${clientId.substring(clientId.length - 4)}` : "too-short-or-missing";
    const maskedSecret = clientSecret && clientSecret.length > 10 ? `...${clientSecret.substring(clientSecret.length - 4)}` : "too-short-or-missing";
    
    console.log("Vercel Integration Token Exchange Debug:");
    console.log("- integration client ID exists:", !!clientId);
    console.log("- masked integration client ID:", maskedClientId);
    console.log("- integration client secret exists:", !!clientSecret);
    console.log("- masked secret fingerprint only:", maskedSecret);
    console.log("- redirect URI:", redirectUri);
    console.log("- token endpoint:", tokenEndpoint);
    console.log("- code exists:", !!code);
    console.log("- configurationId:", configurationId);
    console.log("- teamId:", teamId);

    let redirectDestination: string | undefined;

    try {
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        console.log("Vercel Integration Token Exchange Success:");
        console.log("- token exchange HTTP status:", response.status);
        console.log("- token received:", !!data.access_token);
        console.log("- configurationId present:", !!configurationId);
        console.log("- teamId present:", !!teamId);

        const { encryptedKey: encryptedAccessToken, iv: accessIv } = encryptKey(data.access_token);
        
        cookieStore.delete("vercel_integration_state");

        await db.delete(userIntegrations).where(
          and(eq(userIntegrations.userId, session.user.id), eq(userIntegrations.provider, "vercel"))
        );
        
        await db.insert(userIntegrations).values({
          userId: session.user.id,
          provider: "vercel",
          providerAccountId: data.user_id || "vercel_integration_user",
          configurationId: configurationId || null,
          teamId: teamId || null,
          encryptedAccessToken,
          accessIv,
        });

        let nextUrl = nextParam || "/dashboard/settings";
        if (nextUrl.startsWith("http")) {
          try {
            const parsed = new URL(nextUrl);
            if (!parsed.hostname.endsWith("vercel.com")) {
              nextUrl = "/dashboard/settings";
            }
          } catch {
            nextUrl = "/dashboard/settings";
          }
        }
        
        console.log("- redirect destination origin only:", nextUrl.startsWith("http") ? new URL(nextUrl).origin : "relative");
        redirectDestination = nextUrl;
      } else {
        const errData = await response.text();
        console.error("Vercel Integration Token Exchange failed:", response.status, errData);
        return new Response(`Failed to exchange token: ${errData}`, { status: response.status });
      }
    } catch (err: any) {
      console.error("Token exchange exception:", err);
      return new Response(`Error during token exchange: ${err.message}`, { status: 500 });
    }

    if (redirectDestination) {
      return redirect(redirectDestination);
    }
  } else {
    // -------------------------------------------------------------
    // LEGACY SIGN IN WITH VERCEL APP FLOW (Retained for rollback)
    // -------------------------------------------------------------
    const clientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
    const clientSecret = process.env.VERCEL_APP_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new Response("Vercel OAuth credentials not configured", { status: 500 });
    }

    const redirectUri = `${process.env.AUTH_URL || "https://aibuilderstudio.vercel.app"}/api/auth/vercel/callback`;
    const tokenEndpoint = "https://api.vercel.com/login/oauth/token";
    
    const codeVerifier = cookieStore.get("oauth_code_verifier")?.value;

    if (!codeVerifier) {
      return new Response("Missing PKCE code verifier", { status: 400 });
    }

    const maskedClientId = clientId.length > 10 ? `${clientId.substring(0, 6)}...${clientId.substring(clientId.length - 4)}` : "too-short";
    console.log("Vercel OAuth Token Exchange Debug:");
    console.log("- NEXT_PUBLIC_VERCEL_APP_CLIENT_ID exists:", !!clientId);
    console.log("- Masked Client ID:", maskedClientId);
    
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
          code_verifier: codeVerifier,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const { encryptedKey: encryptedAccessToken, iv: accessIv } = encryptKey(data.access_token);
        
        cookieStore.delete("oauth_code_verifier");

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

        return redirect("/dashboard/settings");
      } else {
        const errData = await response.text();
        console.error("Token exchange failed:", response.status, errData);
        return new Response(`Failed to exchange token: ${errData}`, { status: response.status });
      }
    } catch (err: any) {
      console.error("Token exchange error:", err);
      return new Response(`Error exchanging token: ${err.message}`, { status: 500 });
    }
  }
}
