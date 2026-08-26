"use client";

import React, { useState, useRef, useEffect } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { aiProviders } from "@/lib/ai/registry";

interface WorkspaceClientProps {
  project: {
    id: string;
    name: string;
    status: string;
    selectedProvider: string | null;
    selectedModel: string | null;
  };
  initialMessages?: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }[];
  initialJob?: {
    id: string;
    status: string;
    currentStep: string | null;
    selectedProvider: string | null;
    selectedModel: string | null;
  } | null;
  initialFiles?: {
    path: string;
    content: string;
  }[];
}

export function WorkspaceClient({ project, initialMessages = [], initialJob = null, initialFiles = [] }: WorkspaceClientProps) {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<{path: string, content: string}[]>(initialFiles);
  const [status, setStatus] = useState(project.status);
  const [messages, setMessages] = useState<{role: string, content: string}[]>(
    initialMessages.map(m => ({ role: m.role, content: m.content }))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobState, setJobState] = useState(initialJob);
  
  // Always prefer jobState to show actual fallback provider/model
  const activeProvider = jobState?.selectedProvider || project.selectedProvider;
  const activeModel = jobState?.selectedModel || project.selectedModel;
  const providerInfo = activeProvider ? aiProviders[activeProvider] : null;
  const providerName = providerInfo?.name || activeProvider || "Unknown";
  
  // Job affects active status
  const isActiveJob = jobState && !["COMPLETED", "FAILED", "CANCELLED"].includes(jobState.status);
  const displayStatus = isActiveJob ? "generating" : status;
  const statusColor = displayStatus === "ready" || displayStatus === "deployed" ? "#00a2e6" : "#6b7280";

  // Polling logic
  useEffect(() => {
    if (!isActiveJob) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}/job`);
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setJobState(data.job);
            if (data.job.status === "COMPLETED") {
              setStatus("ready");
              setIsGenerating(false);
            } else if (data.job.status === "FAILED") {
              setStatus("failed");
              setIsGenerating(false);
              setError(data.job.errorMessage || "Generation failed.");
            }
          }
        }
      } catch (err) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [isActiveJob, project.id]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      setStatus("ready");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    const userPrompt = prompt.trim();
    setPrompt("");
    setError(null);
    setStatus("generating");
    setIsGenerating(true);

    const newMessages = [...messages, { role: "user", content: userPrompt }];
    setMessages(newMessages);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          prompt: userPrompt
        }),
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        let errText = await res.text();
        throw new Error(errText);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) throw new Error("No response body");

      let assistantContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // Parse OpenAI SSE format
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices[0]?.delta?.content || "";
              assistantContent += delta;
              
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].content = assistantContent;
                return updated;
              });
            } catch (e) {
              // Ignore incomplete JSON chunks
            }
          }
        }
      }

      setStatus("ready");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Generation error:", err);
        setError(err.message || "An error occurred during generation");
        setStatus("ready");
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

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
            <h1 className="font-headline-sm text-headline-sm text-on-surface line-clamp-1">{project.name || "Workspace"}</h1>
            <div className="flex items-center gap-xs mt-0.5">
              {displayStatus === "generating" ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00a2e6] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00a2e6]"></span>
                </span>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: statusColor }}></span>
              )}
              <span className="font-label-caps text-label-caps tracking-wider uppercase" style={{ color: statusColor }}>
                {isActiveJob ? `JOB: ${jobState?.status}` : displayStatus}
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
              <span>{providerName} ({activeModel})</span>
            </div>
          </div>
          
          <Button variant="secondary" size="sm" className="gap-xs hidden sm:flex" disabled={displayStatus === "generating"} onClick={() => handleSubmit()}>
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Regenerate
          </Button>
          <Button variant="danger" size="sm" className="gap-xs hidden sm:flex" disabled={displayStatus !== "generating"} onClick={handleStop}>
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
        {/* LEFT PANEL: AI Conversation */}
        <aside className="w-[340px] flex flex-col border-r border-outline-variant/20 bg-surface-container-lowest shrink-0 z-10 hidden md:flex">
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant font-body-sm p-6 text-center h-full">
                <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">forum</span>
                <h3 className="font-headline-sm text-on-surface mb-2">Describe what you want to build</h3>
                <p className="text-xs text-on-surface-variant/70">
                  AI Builder Studio will generate and refine your application.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-surface-container-high text-on-surface ml-4' : 'bg-transparent text-on-surface-variant mr-4'}`}>
                  <div className="font-label-caps text-xs opacity-50 mb-1">{msg.role === 'user' ? 'You' : providerName}</div>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-mono text-xs">
                      {msg.content || (isGenerating && idx === messages.length - 1 ? 'Thinking...' : '')}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              ))
            )}
            {error && (
              <div className="p-3 rounded-lg text-sm bg-error/10 text-error border border-error/20 mr-4">
                <span className="font-label-caps text-xs opacity-50 mb-1">Error</span>
                <div className="whitespace-pre-wrap">{error}</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low">
            <form onSubmit={handleSubmit} className="bg-surface-container-highest border border-outline-variant/30 rounded-xl p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all shadow-inner">
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                className="w-full h-20 bg-transparent text-on-surface text-sm resize-none outline-none placeholder:text-on-surface-variant/40 p-2 disabled:opacity-50" 
                placeholder={isGenerating ? "Generating..." : "Message AI..."}
              ></textarea>
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-outline-variant/10">
                <div className="flex items-center gap-1">
                  <button type="button" className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded disabled:opacity-50" disabled={isGenerating} title="Attach context">
                    <span className="material-symbols-outlined text-[18px]">attach_file</span>
                  </button>
                  <button type="button" className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded disabled:opacity-50" disabled={isGenerating} title="Use Voice">
                    <span className="material-symbols-outlined text-[18px]">mic</span>
                  </button>
                </div>
                <Button type="submit" size="sm" disabled={isGenerating || !prompt.trim()} className="!px-3 !py-1 h-auto text-xs">
                  {isGenerating ? (
                    <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-[14px]">send</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </aside>

        {/* CENTER PANEL: Live Application Preview */}
        <section className="flex-1 flex flex-col bg-surface-dim relative min-w-0">
          <div className="h-12 border-b border-outline-variant/10 bg-surface-container flex items-center justify-between px-md shrink-0">
            <div className="flex items-center gap-sm">
              <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded">Preview</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-2">
                {status === "draft" ? "Ready to start building" : 
                 status === "generating" ? "Generating..." : "Ready"}
              </span>
            </div>
            <div className="flex gap-2">
              <button className="text-on-surface-variant hover:text-on-surface p-1"><span className="material-symbols-outlined text-[18px]">open_in_new</span></button>
            </div>
          </div>
          <div className="flex-1 p-4 sm:p-lg overflow-y-auto flex justify-center items-center">
            {messages.length === 0 ? (
              <div className="w-full max-w-[800px] bg-[#0f0f11] rounded-xl border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col min-h-[500px] ring-1 ring-white/5">
                <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-8 text-center">
                  <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">design_services</span>
                  <h2 className="font-headline-sm text-on-surface mb-2">Workspace Canvas</h2>
                  <p className="text-sm max-w-md">
                    This canvas will render your generated application when the AI completes the initial draft.
                  </p>
                  <div className="mt-6 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm">
                    Ready to start building
                  </div>
                </div>
              </div>
            ) : status === "generating" ? (
              <div className="flex flex-col items-center justify-center gap-4 text-on-surface-variant">
                <span className="material-symbols-outlined text-[48px] animate-spin">sync</span>
                <p>Generating your application...</p>
              </div>
            ) : (
              <div className="w-full max-w-[800px] bg-[#0f0f11] rounded-xl border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col min-h-[500px] ring-1 ring-white/5 relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                  {files.length > 0 ? (
                    <>
                      <span className="material-symbols-outlined text-[48px] mb-4 text-[#00a2e6]">check_circle</span>
                      <h2 className="font-headline-sm text-on-surface mb-2">Project Generated</h2>
                      <p className="text-sm text-on-surface-variant max-w-md">
                        {files.length} files were successfully generated for this project.
                        Actual application preview rendering will be available soon.
                      </p>
                    </>
                  ) : (
                    <p className="text-on-surface-variant/50">Preview rendering coming soon</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL: File Structure & Code */}
        <aside className="w-[380px] flex flex-col border-l border-outline-variant/20 bg-surface-container-lowest shrink-0 z-10 hidden lg:flex">
          <div className="h-12 border-b border-outline-variant/10 bg-surface-container-low flex items-center px-4 shrink-0">
             <span className="font-label-caps text-label-caps text-on-surface-variant">Output & Code</span>
          </div>
          <div className="flex-1 flex flex-col text-on-surface-variant font-body-sm p-4 overflow-y-auto">
            {isActiveJob ? (
               <div className="flex-1 flex flex-col items-center justify-center text-center">
                 <span className="material-symbols-outlined text-[48px] mb-4 text-[#00a2e6] animate-pulse">settings</span>
                 <p className="text-sm text-on-surface font-semibold">{jobState?.currentStep || "Generating background job..."}</p>
                 <p className="text-xs mt-2 opacity-70">Provider: {jobState?.selectedProvider || providerName}</p>
                 <p className="text-xs mt-1 opacity-50">You can safely close this tab.</p>
               </div>
            ) : files.length > 0 ? (
              <div className="flex flex-col gap-4 w-full">
                {files.map((file, idx) => (
                  <div key={idx} className="flex flex-col rounded bg-surface-container-highest border border-outline-variant/20 overflow-hidden">
                    <div className="bg-surface-container-high px-3 py-1.5 border-b border-outline-variant/20 flex items-center justify-between">
                      <span className="font-mono text-xs text-on-surface">{file.path}</span>
                    </div>
                    <div className="p-3 bg-[#0f0f11] text-xs font-mono text-on-surface-variant overflow-x-auto whitespace-pre">
                      {file.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.filter(m => m.role === 'assistant').length > 0 ? (
              <div className="prose prose-invert prose-sm max-w-none w-full whitespace-pre-wrap font-mono text-xs">
                 {messages.filter(m => m.role === 'assistant').pop()?.content || ""}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">data_object</span>
                <p className="text-sm">Generated code will appear here</p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
