import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema/settings";
import { eq, and } from "drizzle-orm";
import { encryptKey } from "@/lib/encryption";

export default async function VercelConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ configurationId?: string; teamId?: string; next?: string; code?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user?.id) {
    // If user is not logged in, they need to log in first and then return here.
    const search = new URLSearchParams();
    if (params.configurationId) search.set("configurationId", params.configurationId);
    if (params.teamId) search.set("teamId", params.teamId);
    if (params.next) search.set("next", params.next);
    if (params.code) search.set("code", params.code);
    
    return redirect(`/login?callbackUrl=${encodeURIComponent(`/vercel/configure?${search.toString()}`)}`);
  }

  const clientId = process.env.VERCEL_INTEGRATION_CLIENT_ID || process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  const clientSecret = process.env.VERCEL_INTEGRATION_CLIENT_SECRET || process.env.VERCEL_APP_CLIENT_SECRET;

  // The OAuth token exchange is now handled separately by /api/auth/vercel/callback
  // This page only renders the UI for the Vercel Integration configuration.

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface-container rounded-2xl p-8 border border-outline-variant/20 shadow-xl text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-[32px] text-primary">integration_instructions</span>
        </div>
        
        <h1 className="font-headline-md text-on-surface mb-2">Vercel Integration</h1>
        <p className="text-on-surface-variant font-body-md mb-8">
          Your AI Builder Studio integration with Vercel is being configured.
        </p>

        {params.configurationId && (
          <div className="bg-surface-container-highest p-4 rounded-xl mb-6 text-left">
            <div className="text-xs text-on-surface-variant mb-1 font-label-caps">Configuration ID</div>
            <code className="text-sm font-mono text-on-surface">{params.configurationId}</code>
          </div>
        )}

        <div className="bg-[#00a2e6]/10 text-[#00a2e6] px-4 py-3 rounded-lg text-sm mb-8 border border-[#00a2e6]/20">
          The integration was successfully linked to your account.
        </div>

        {params.next ? (
          <a
            href={params.next}
            className="w-full inline-flex justify-center items-center h-12 rounded-full bg-primary text-on-primary font-label-lg transition-all hover:opacity-90"
          >
            Return to Vercel
          </a>
        ) : (
          <a
            href="/dashboard"
            className="w-full inline-flex justify-center items-center h-12 rounded-full bg-primary text-on-primary font-label-lg transition-all hover:opacity-90"
          >
            Go to Dashboard
          </a>
        )}
      </div>
    </div>
  );
}
