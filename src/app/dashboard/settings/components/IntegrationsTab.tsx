"use client";

import { Button } from "@/components/ui/Button";
import { signIn } from "next-auth/react";

export function IntegrationsTab({ integrations, isGithubConnected = false, envConfigured = { github: false, vercel: false } }: { integrations: { provider: string }[], isGithubConnected?: boolean, envConfigured?: { github: boolean, vercel: boolean } }) {
  const hasVercel = integrations.some(i => i.provider === "vercel");
  const hasGithub = isGithubConnected;

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      
      {/* Deployment Targets Section */}
      <section>
        <h2 className="font-headline-sm text-on-surface mb-4">Deployment Targets</h2>
        <div className="bg-surface-container-high rounded-xl p-lg border border-outline-variant/30 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xl">
              V
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-headline-sm text-on-surface truncate">Vercel</h3>
              <p className="text-on-surface-variant text-sm truncate">Deploy generated AI applications to production.</p>
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
              <a href="/api/auth/vercel/integration">
                <Button variant="secondary">
                  {hasVercel ? "Reconnect Vercel" : "Connect Vercel"}
                </Button>
              </a>
            )}
          </div>
          {!envConfigured.vercel && (
            <p className="text-xs text-on-surface-variant italic">
              * Vercel Integration requires the Vercel OAuth App credentials to be configured by the administrator first.
            </p>
          )}
        </div>
      </section>

      {/* Source Control Section */}
      <section>
        <h2 className="font-headline-sm text-on-surface mb-4">Source Control</h2>
        <div className="bg-surface-container-high rounded-xl p-lg border border-outline-variant/30 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#24292e] text-white flex items-center justify-center">
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
              <Button variant="secondary" onClick={() => signIn("github")}>
                {hasGithub ? "Reconnect GitHub" : "Connect GitHub"}
              </Button>
            )}
          </div>
          {!envConfigured.github && (
            <p className="text-xs text-on-surface-variant italic">
              * GitHub Integration requires the GitHub OAuth App credentials to be configured by the administrator first.
            </p>
          )}
        </div>
      </section>

      {/* Services Section */}
      <section>
        <h2 className="font-headline-sm text-on-surface mb-4">Services</h2>
        <div className="bg-surface-container-high rounded-xl p-lg border border-outline-variant/30 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#25D366] text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">chat</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-headline-sm text-on-surface truncate">WhatsApp Business</h3>
              <p className="text-on-surface-variant text-sm truncate">Connect for WHATSAPP_BOT applications.</p>
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
      </section>
      
    </div>
  );
}
