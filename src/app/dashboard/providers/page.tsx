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
  const personalLLMs = allProviders.filter(p => p.category === "personal" && configuredProvidersSet.has(p.id));
  const absAI = allProviders.filter(p => p.category === "abs");

  const renderProvider = (provider: typeof aiProviders[keyof typeof aiProviders], isAbs = false) => {
    const isConfigured = configuredProvidersSet.has(provider.id);
    const requiresKey = provider.requiresKey;
    const isDefault = defaultProvider === provider.id;
    
    let statusColor = "bg-surface-container-highest text-on-surface-variant";
    let statusText = "Not Configured";
    
    if (isAbs) {
      statusColor = "bg-primary/20 text-primary";
      statusText = "Coming Soon";
    } else if (isConfigured || !requiresKey) {
      statusColor = "bg-primary/20 text-primary";
      statusText = "Connected";
    } else if (!isConfigured && requiresKey) {
      statusColor = "bg-error/10 text-error";
      statusText = "Not Configured";
    }
    
    return (
      <div key={provider.id} className="bg-surface-container rounded-xl p-lg border border-outline-variant/30 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface border border-outline-variant/50 shrink-0">
                <span className="material-symbols-outlined">{provider.id === 'openai' ? 'smart_toy' : provider.id.includes('google') ? 'search' : isAbs ? 'architecture' : 'psychology'}</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-headline-sm text-on-surface truncate">{provider.name}</h3>
                {isDefault && <span className="text-[10px] uppercase font-bold text-tertiary">Default Provider</span>}
              </div>
            </div>
            <span className={`text-[10px] uppercase px-2 py-1 rounded-full font-bold shrink-0 ${statusColor}`}>
              {statusText}
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mb-4">
            {isAbs ? `Built-in ABS capability for ${provider.name}.` : `Integration for ${provider.name} AI models.`}
          </p>
          
          <div className="mb-4">
            <h4 className="font-label-sm text-on-surface-variant mb-2">Supported Models</h4>
            <div className="flex flex-wrap gap-2">
              {provider.defaultModels.map((m: string) => (
                <span key={m} className="text-[10px] sm:text-xs px-2 py-1 bg-surface-container-high border border-outline-variant/30 rounded text-on-surface truncate max-w-full">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        {!isAbs && (
          <div className="mt-4 pt-4 border-t border-outline-variant/20 flex items-center justify-end">
            <Link href="/dashboard/settings">
              <Button variant={isConfigured ? "secondary" : "primary"} size="sm">
                {isConfigured ? "Manage Key" : "Configure Key"}
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-10 max-w-5xl">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">AI Providers</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Manage your connected AI models and AI Builder Studio capabilities.
        </p>
      </header>
      
      <section>
        <div className="mb-4 border-b border-outline-variant/20 pb-2">
          <h2 className="font-headline-sm text-on-surface">Personal LLMs</h2>
          <p className="text-body-sm text-on-surface-variant">Connect your own AI providers and API keys.</p>
        </div>
        {personalLLMs.length === 0 ? (
          <div className="bg-surface-container-high rounded-xl p-lg border border-outline-variant/30 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-4">vpn_key_off</span>
            <h3 className="font-headline-sm text-on-surface mb-2">No Providers Connected</h3>
            <p className="text-body-sm text-on-surface-variant mb-6">
              You haven't configured any personal LLM API keys yet.
            </p>
            <Link href="/dashboard/settings">
              <Button>Configure API Keys</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personalLLMs.map(p => renderProvider(p, false))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 border-b border-outline-variant/20 pb-2">
          <h2 className="font-headline-sm text-on-surface">ABS AI</h2>
          <p className="text-body-sm text-on-surface-variant">Built-in AI capabilities provided by AI Builder Studio.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {absAI.map(p => renderProvider(p, true))}
        </div>
      </section>
    </div>
  );
}
