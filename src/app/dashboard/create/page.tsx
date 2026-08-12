"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/Button";

export default function CreateProjectPage() {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="flex-1 w-full max-w-[960px] mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-140px)] py-xl md:py-12">
      <div className="w-full max-w-3xl space-y-xl">
        
        {/* Header */}
        <div className="text-center space-y-sm">
          <h2 className="font-display-lg text-display-lg text-on-surface tracking-tight">What are we building today?</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-prose mx-auto">Describe your vision. ABS will scaffold the architecture, connect providers, and generate the foundation.</p>
        </div>

        {/* Main Prompt Editor Area */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 transition-all duration-300 shadow-lg shadow-black/50">
          <textarea 
            className="w-full h-40 bg-transparent text-on-surface font-headline-sm text-headline-sm resize-none outline-none placeholder:text-on-surface-variant/40 p-sm leading-relaxed" 
            placeholder="Build a high-performance analytics dashboard for tracking SaaS metrics. It needs real-time charts, user authentication, and a dark mode UI. Use sample data to populate the initial views."
          ></textarea>
          
          <div className="flex items-center justify-between mt-sm border-t border-surface-container-highest pt-sm px-sm">
            <div className="flex items-center gap-sm">
              <button className="text-on-surface-variant hover:text-on-surface transition-colors p-xs rounded" title="Attach context">
                <span className="material-symbols-outlined text-[20px]">attach_file</span>
              </button>
              <button className="text-on-surface-variant hover:text-on-surface transition-colors p-xs rounded" title="Use Voice">
                <span className="material-symbols-outlined text-[20px]">mic</span>
              </button>
            </div>
            <div className="font-code-md text-code-md text-on-surface-variant/50">
              0 / 2000
            </div>
          </div>
        </div>

        {/* Example Prompts (Chips) */}
        <div className="flex flex-wrap items-center justify-center gap-sm">
          <span className="font-label-caps text-label-caps text-on-surface-variant mr-xs">Try:</span>
          <button className="px-md py-xs rounded-full bg-surface-container-low border border-surface-container-highest text-on-surface hover:bg-surface-container transition-colors font-body-sm text-body-sm">CRM for real estate</button>
          <button className="px-md py-xs rounded-full bg-surface-container-low border border-surface-container-highest text-on-surface hover:bg-surface-container transition-colors font-body-sm text-body-sm">NFT Marketplace</button>
          <button className="px-md py-xs rounded-full bg-surface-container-low border border-surface-container-highest text-on-surface hover:bg-surface-container transition-colors font-body-sm text-body-sm">Internal HR Tool</button>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md mt-xl">
          <div className="space-y-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider pl-xs block">Project Name</label>
            <input className="w-full bg-[#0A0A0A] border border-surface-container-highest rounded text-on-surface font-body-md text-body-md px-md py-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" placeholder="e.g., Nexus Dashboard" type="text" />
          </div>
          
          <div className="space-y-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider pl-xs block">Framework</label>
            <div className="relative">
              <select className="w-full bg-[#0A0A0A] border border-surface-container-highest rounded text-on-surface font-body-md text-body-md px-md py-sm appearance-none outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
                <option>Next.js</option>
                <option>Vue / Nuxt</option>
                <option>SvelteKit</option>
              </select>
              <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
            </div>
          </div>
          
          <div className="space-y-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider pl-xs block">AI Provider</label>
            <div className="relative">
              <select className="w-full bg-[#0A0A0A] border border-surface-container-highest rounded text-on-surface font-body-md text-body-md pl-10 pr-md py-sm appearance-none outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
                <option>OpenAI (GPT-4o)</option>
                <option>Anthropic (Claude 3.5)</option>
                <option>Google (Gemini 1.5)</option>
              </select>
              <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">smart_toy</span>
              <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <div className="mt-lg border border-surface-container-highest rounded-lg bg-[#161616] overflow-hidden">
          <button 
            className="w-full flex items-center justify-between p-md text-on-surface hover:bg-surface-container-low transition-colors" 
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            <span className="font-body-md text-body-md font-semibold flex items-center gap-sm">
              <span className="material-symbols-outlined text-[18px]">tune</span>
              Advanced Architecture
            </span>
            <span className="material-symbols-outlined text-on-surface-variant">
              {advancedOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          
          {advancedOpen && (
            <div className="p-md border-t border-surface-container-highest bg-[#161616]/50 space-y-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                <div className="space-y-xs">
                  <label className="font-label-caps text-label-caps text-on-surface-variant block pl-xs">Database Type</label>
                  <select className="w-full bg-[#0A0A0A] border border-surface-container-highest rounded text-on-surface font-body-sm text-body-sm px-sm py-xs outline-none focus:border-primary">
                    <option>PostgreSQL (Supabase)</option>
                    <option>MongoDB</option>
                    <option>SQLite</option>
                  </select>
                </div>
                <div className="space-y-xs">
                  <label className="font-label-caps text-label-caps text-on-surface-variant block pl-xs">Auth Provider</label>
                  <select className="w-full bg-[#0A0A0A] border border-surface-container-highest rounded text-on-surface font-body-sm text-body-sm px-sm py-xs outline-none focus:border-primary">
                    <option>NextAuth / Auth.js</option>
                    <option>Clerk</option>
                    <option>Supabase Auth</option>
                  </select>
                </div>
                <div className="space-y-xs">
                  <label className="font-label-caps text-label-caps text-on-surface-variant block pl-xs">API Structure</label>
                  <select className="w-full bg-[#0A0A0A] border border-surface-container-highest rounded text-on-surface font-body-sm text-body-sm px-sm py-xs outline-none focus:border-primary">
                    <option>REST (App Router)</option>
                    <option>tRPC</option>
                    <option>GraphQL</option>
                  </select>
                </div>
                <div className="space-y-xs md:col-span-3 pt-sm">
                  <label className="font-label-caps text-label-caps text-on-surface-variant block pl-xs">Git Repository Link (Optional)</label>
                  <input className="w-full bg-[#0A0A0A] border border-surface-container-highest rounded text-on-surface font-body-sm text-body-sm px-sm py-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" placeholder="https://github.com/username/repo" type="text" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Primary Action */}
        <div className="pt-xl flex justify-center">
          <Button className="py-md px-xl gap-sm h-auto text-base shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            <span className="font-headline-sm text-headline-sm tracking-wide">Generate Project</span>
          </Button>
        </div>
        
      </div>
    </div>
  );
}
