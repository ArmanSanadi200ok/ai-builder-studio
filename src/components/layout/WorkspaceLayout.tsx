import * as React from "react";
import { IconButton } from "../ui/IconButton";
import { Button } from "../ui/Button";
import Link from "next/link";
import { aiProviders } from "@/lib/ai/registry";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  project: any;
}

export function WorkspaceLayout({ children, project }: WorkspaceLayoutProps) {
  const providerInfo = project?.selectedProvider ? aiProviders[project.selectedProvider] : null;
  const providerName = providerInfo?.name || project?.selectedProvider || "Unknown";
  const statusColor = project?.status === "ready" || project?.status === "deployed" ? "#00a2e6" : "#6b7280";
  
  return (
    <div className="bg-surface text-on-surface font-body-md h-screen flex flex-col overflow-hidden selection:bg-primary-container selection:text-white">
      {/* Workspace Header */}
      <header className="h-16 flex items-center justify-between px-md border-b border-outline-variant/20 bg-surface shrink-0 z-20">
        <div className="flex items-center gap-md">
          <Link href="/dashboard/projects">
            <IconButton icon="arrow_back" />
          </Link>
          <div className="h-5 w-[1px] bg-outline-variant/30"></div>
          <div>
            <h1 className="font-headline-sm text-headline-sm text-on-surface line-clamp-1">{project?.name || "Workspace"}</h1>
            <div className="flex items-center gap-xs mt-0.5">
              {project?.status === "generating" ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00a2e6] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00a2e6]"></span>
                </span>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: statusColor }}></span>
              )}
              <span className="font-label-caps text-label-caps tracking-wider uppercase" style={{ color: statusColor }}>
                {project?.status === "generating" ? "LIVE GENERATION" : project?.status}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-sm">
          <div className="hidden md:flex items-center gap-2 mr-4 border-r border-outline-variant/20 pr-4">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Model:</span>
            <div className="flex items-center gap-1.5 bg-surface-container px-2 py-1 rounded border border-primary/30 text-primary font-body-sm">
              <span className="material-symbols-outlined text-[16px]">
                {providerInfo?.category === "abs" ? "architecture" : "smart_toy"}
              </span>
              <span>{providerName}</span>
            </div>
          </div>
          
          <Button variant="secondary" size="sm" className="gap-xs hidden sm:flex" disabled={project?.status === "generating"}>
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Regenerate
          </Button>
          <Button variant="danger" size="sm" className="gap-xs hidden sm:flex" disabled={project?.status !== "generating"}>
            <span className="material-symbols-outlined text-[16px]">stop_circle</span>
            Stop
          </Button>
          <Button className="ml-sm gap-xs bg-[#00a2e6]" size="sm">
            <span className="material-symbols-outlined text-[16px]">publish</span>
            Deploy
          </Button>
        </div>
      </header>

      {/* Main 3-Panel Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: AI Conversation & Pipeline */}
        <aside className="w-[340px] flex flex-col border-r border-outline-variant/20 bg-surface-container-lowest shrink-0 z-10 hidden md:flex">
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant font-body-sm p-6 text-center">
            <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">forum</span>
            <h3 className="font-headline-sm text-on-surface mb-2">Describe what you want to build</h3>
            <p className="text-xs text-on-surface-variant/70">
              AI Builder Studio will generate and refine your application. The AI Generation pipeline is coming in the next phase.
            </p>
          </div>
          <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low">
            <div className="bg-surface-container-highest border border-outline-variant/30 rounded-xl p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all shadow-inner">
              <textarea 
                className="w-full h-20 bg-transparent text-on-surface text-sm resize-none outline-none placeholder:text-on-surface-variant/40 p-2" 
                placeholder="Message AI..."
              ></textarea>
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-outline-variant/10">
                <div className="flex items-center gap-1">
                  <button type="button" className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded" title="Attach context">
                    <span className="material-symbols-outlined text-[18px]">attach_file</span>
                  </button>
                  <button type="button" className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded" title="Use Voice">
                    <span className="material-symbols-outlined text-[18px]">mic</span>
                  </button>
                </div>
                <Button size="sm" className="!px-3 !py-1 h-auto text-xs">
                  <span className="material-symbols-outlined text-[14px]">send</span>
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER PANEL: Live Application Preview */}
        <section className="flex-1 flex flex-col bg-surface-dim relative min-w-0">
          <div className="h-12 border-b border-outline-variant/10 bg-surface-container flex items-center justify-between px-md shrink-0">
            <div className="flex items-center gap-sm">
              <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded">Preview</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-2">
                {project?.status === "draft" ? "Not generated" : 
                 project?.status === "generating" ? "Generating..." : "Ready"}
              </span>
            </div>
            <div className="flex gap-2">
              <button className="text-on-surface-variant hover:text-on-surface p-1"><span className="material-symbols-outlined text-[18px]">open_in_new</span></button>
            </div>
          </div>
          <div className="flex-1 p-4 sm:p-lg overflow-y-auto flex justify-center items-start">
             {children}
          </div>
        </section>

        {/* RIGHT PANEL: File Structure & Code */}
        <aside className="w-[380px] flex flex-col border-l border-outline-variant/20 bg-surface-container-lowest shrink-0 z-10 hidden lg:flex">
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant font-body-sm p-6 text-center">
            <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">data_object</span>
            <p className="text-sm">Code Editor Foundation</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
