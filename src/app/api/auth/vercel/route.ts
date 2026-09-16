import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId = process.env.VERCEL_INTEGRATION_CLIENT_ID || process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  if (!clientId) {
    return new Response("Vercel Client ID not configured", { status: 500 });
  }

  // Create state to prevent CSRF
  const state = crypto.randomUUID();
  // Here we would typically save state to a cookie or database to verify later
  
  // Standard Vercel OAuth authorization URL
  const url = new URL("https://vercel.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", `${process.env.AUTH_URL || "https://aibuilderstudio.vercel.app"}/api/auth/vercel/callback`);
  
  return redirect(url.toString());
}
