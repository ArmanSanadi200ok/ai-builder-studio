import { auth } from "@/auth";
import { db } from "@/db";
import { userApiKeys } from "@/db/schema/users";
import { userSettings } from "@/db/schema/settings";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { aiProviders } from "@/lib/ai/registry";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function ProvidersPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const configuredKeys = await db.query.userApiKeys.findMany({
    where: eq(userApiKeys.userId, session.user.id),
  });
  
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.user.id),
  });

  const configuredProvidersSet = new Set(configuredKeys.map(k => k.provider));
  const defaultProvider = settings?.defaultProvider || "openai";

  const allProviders = Object.values(aiProviders);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">AI Providers</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Manage your connected AI models and API integrations.
        </p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allProviders.map(provider => {
          const isConfigured = configuredProvidersSet.has(provider.id);
          const requiresKey = provider.requiresKey;
          const isDefault = defaultProvider === provider.id;
          const statusColor = isConfigured || !requiresKey ? "bg-primary/20 text-primary" : "bg-error/10 text-error";
          const statusText = isConfigured ? "Connected" : !requiresKey ? "Local/Available" : "Not Configured";
          
          return (
            <div key={provider.id} className="bg-surface-container rounded-xl p-lg border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface border border-outline-variant/50">
                      <span className="material-symbols-outlined">{provider.id === 'openai' ? 'smart_toy' : provider.id.includes('google') ? 'search' : 'psychology'}</span>
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-on-surface">{provider.name}</h3>
                      {isDefault && <span className="text-[10px] uppercase font-bold text-tertiary">Default Provider</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-label-sm ${statusColor}`}>
                    {statusText}
                  </span>
                </div>
                <p className="text-body-sm text-on-surface-variant mb-4">
                  Integration for {provider.name} AI models.
                </p>
                
                <div className="mb-4">
                  <h4 className="font-label-sm text-on-surface-variant mb-2">Supported Models</h4>
                  <div className="flex flex-wrap gap-2">
                    {provider.defaultModels.map((m: string) => (
                      <span key={m} className="text-xs px-2 py-1 bg-surface-container-high border border-outline-variant/30 rounded text-on-surface">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-outline-variant/20 flex items-center justify-end">
                <Link href="/dashboard/settings">
                  <Button variant={isConfigured ? "secondary" : "primary"} size="sm">
                    {isConfigured ? "Manage Key" : "Configure Key"}
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
