import * as React from "react";
import { IconButton } from "../ui/IconButton";
import { Button } from "../ui/Button";

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface text-on-surface font-body-md h-screen flex flex-col overflow-hidden selection:bg-primary-container selection:text-white">
      {/* Workspace Header */}
      <header className="h-16 flex items-center justify-between px-md border-b border-outline-variant/20 bg-surface shrink-0 z-20">
        <div className="flex items-center gap-md">
          <IconButton icon="arrow_back" />
          <div className="h-5 w-[1px] bg-outline-variant/30"></div>
          <div>
            <h1 className="font-headline-sm text-headline-sm text-on-surface">Workspace</h1>
            <div className="flex items-center gap-xs mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00a2e6] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00a2e6]"></span>
              </span>
              <span className="font-label-caps text-label-caps text-[#00a2e6] tracking-wider uppercase">Live Generation</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-sm">
          <div className="flex items-center gap-2 mr-4 border-r border-outline-variant/20 pr-4">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Model:</span>
            <div className="flex items-center gap-1.5 bg-surface-container px-2 py-1 rounded border border-primary/30 text-primary font-body-sm">
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              <span>Gemini Pro</span>
            </div>
          </div>
          
          <Button variant="secondary" size="sm" className="gap-xs">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Regenerate
          </Button>
          <Button variant="danger" size="sm" className="gap-xs">
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
          <div className="flex-1 flex items-center justify-center text-on-surface-variant font-body-sm">
            AI Panel Placeholder
          </div>
        </aside>

        {/* CENTER PANEL: Live Application Preview */}
        <section className="flex-1 flex flex-col bg-surface-dim relative min-w-0">
          <div className="h-12 border-b border-outline-variant/10 bg-surface-container flex items-center justify-between px-md shrink-0">
            <div className="flex items-center gap-sm">
              <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded">Preview</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">localhost:3000</span>
            </div>
          </div>
          <div className="flex-1 p-lg overflow-y-auto flex justify-center items-start">
             {children}
          </div>
        </section>

        {/* RIGHT PANEL: File Structure & Code */}
        <aside className="w-[380px] flex flex-col border-l border-outline-variant/20 bg-surface-container-lowest shrink-0 z-10 hidden lg:flex">
          <div className="flex-1 flex items-center justify-center text-on-surface-variant font-body-sm">
             Code Editor Placeholder
          </div>
        </aside>
      </main>
    </div>
  );
}
