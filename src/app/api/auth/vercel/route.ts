import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  if (!clientId) {
    return new Response("Vercel Client ID not configured", { status: 500 });
  }

  // Create state to prevent CSRF
  const state = crypto.randomUUID();
  
  // PKCE Generation
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  // Save code_verifier in cookie
  cookies().set("oauth_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  // Standard Vercel OAuth authorization URL
  const url = new URL("https://vercel.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("redirect_uri", `${process.env.AUTH_URL || "https://aibuilderstudio.vercel.app"}/api/auth/vercel/callback`);
  
  return redirect(url.toString());
}
