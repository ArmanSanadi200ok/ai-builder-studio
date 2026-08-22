"use client";

import { Button } from "@/components/ui/Button";

export function IntegrationsTab({ integrations, envConfigured = { github: false, vercel: false } }: { integrations: { provider: string }[], envConfigured?: { github: boolean, vercel: boolean } }) {
  const hasVercel = integrations.some(i => i.provider === "vercel");
  const hasGithub = integrations.some(i => i.provider === "github_integration");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="bg-surface-container-high rounded-xl p-lg border border-outline-variant/30 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xl">
            V
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-headline-sm text-on-surface truncate">Vercel</h3>
            <p className="text-on-surface-variant text-sm truncate">Deploy generated AI applications.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasVercel ? 'bg-primary' : (envConfigured.vercel ? 'bg-outline' : 'bg-error')}`}></div>
            <span className="font-label-md text-on-surface-variant">
              {hasVercel ? "Connected" : envConfigured.vercel ? "Ready to connect" : "OAuth configuration required"}
            </span>
          </div>
          {envConfigured.vercel && (
            <Button variant="secondary" disabled>
              Coming Soon
            </Button>
          )}
        </div>
        {!envConfigured.vercel && (
          <p className="text-xs text-on-surface-variant italic">
            * Vercel Integration requires the Vercel OAuth App credentials to be configured by the administrator first.
          </p>
        )}
      </div>

      <div className="bg-surface-container-high rounded-xl p-lg border border-outline-variant/30 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#24292e] text-white flex items-center justify-center">
            {/* GitHub Icon Placeholder */}
            <span className="material-symbols-outlined text-[24px]">code</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-headline-sm text-on-surface truncate">GitHub Repositories</h3>
            <p className="text-on-surface-variant text-sm truncate">Push generated code directly to GitHub.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasGithub ? 'bg-primary' : (envConfigured.github ? 'bg-outline' : 'bg-error')}`}></div>
            <span className="font-label-md text-on-surface-variant">
              {hasGithub ? "Connected" : envConfigured.github ? "Ready to connect" : "OAuth configuration required"}
            </span>
          </div>
          {envConfigured.github && (
            <Button variant="secondary" disabled>
              Coming Soon
            </Button>
          )}
        </div>
        {!envConfigured.github && (
          <p className="text-xs text-on-surface-variant italic">
            * GitHub Integration requires the GitHub OAuth App credentials to be configured by the administrator first.
          </p>
        )}
      </div>

      <div className="bg-surface-container-high rounded-xl p-lg border border-outline-variant/30 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#25D366] text-white flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">chat</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-headline-sm text-on-surface truncate">WhatsApp Business</h3>
            <p className="text-on-surface-variant text-sm truncate">Deploy AI chatbots directly to WhatsApp.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-outline"></div>
            <span className="font-label-md text-on-surface-variant">
              Not Configured
            </span>
          </div>
          <Button variant="secondary" disabled>
            Coming Soon
          </Button>
        </div>
      </div>
    </div>
  );
}
