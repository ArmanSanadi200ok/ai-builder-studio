import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const slug = process.env.VERCEL_INTEGRATION_SLUG;
  if (!slug) {
    return new Response("Vercel Integration Slug not configured (VERCEL_INTEGRATION_SLUG)", { status: 500 });
  }

  // Create state to prevent CSRF
  const state = crypto.randomUUID();
  
  // Save state in cookie for callback validation
  const cookieStore = await cookies();
  cookieStore.set("vercel_integration_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  // Vercel Integration installation URL
  const url = new URL(`https://vercel.com/integrations/${slug}/new`);
  url.searchParams.set("state", state);
  
  return redirect(url.toString());
}
