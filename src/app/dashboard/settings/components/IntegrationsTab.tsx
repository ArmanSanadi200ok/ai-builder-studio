"use client";

import { Button } from "@/components/ui/Button";

export function IntegrationsTab({ integrations }: { integrations: { provider: string }[] }) {
  const hasVercel = integrations.some(i => i.provider === "vercel");
  const hasGithub = integrations.some(i => i.provider === "github_integration");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="bg-surface-container-high rounded-xl p-lg border border-outline-variant/30 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xl">
            V
          </div>
          <div className="flex-1">
            <h3 className="font-headline-sm text-on-surface">Vercel</h3>
            <p className="text-on-surface-variant text-sm">Deploy generated AI applications directly to your Vercel account.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasVercel ? 'bg-primary' : 'bg-outline'}`}></div>
            <span className="font-label-md text-on-surface-variant">
              {hasVercel ? "Connected" : "Not configured / Setup required"}
            </span>
          </div>
          <Button variant={hasVercel ? "secondary" : "primary"} disabled>
            {hasVercel ? "Disconnect" : "Connect Vercel"}
          </Button>
        </div>
        {!hasVercel && (
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
          <div className="flex-1">
            <h3 className="font-headline-sm text-on-surface">GitHub Repositories</h3>
            <p className="text-on-surface-variant text-sm">Push generated code directly to your GitHub account.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasGithub ? 'bg-primary' : 'bg-outline'}`}></div>
            <span className="font-label-md text-on-surface-variant">
              {hasGithub ? "Connected" : "Not configured / Setup required"}
            </span>
          </div>
          <Button variant={hasGithub ? "secondary" : "primary"} disabled>
            {hasGithub ? "Disconnect" : "Connect GitHub"}
          </Button>
        </div>
        {!hasGithub && (
          <p className="text-xs text-on-surface-variant italic">
            * Note: This is separate from your login account. It requires explicit repository management scopes.
          </p>
        )}
      </div>
    </div>
  );
}
