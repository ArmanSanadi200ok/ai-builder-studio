import { auth } from "@/auth";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Returning 400 since Vercel integration backend is not built yet
    // This allows UI to show the "Connect your Vercel integration in Settings before deploying" honest fallback.
    return new Response("Connect your Vercel integration in Settings before deploying.", { status: 400 });
  } catch (err: any) {
    return new Response(`Deploy error: ${err.message}`, { status: 500 });
  }
}
