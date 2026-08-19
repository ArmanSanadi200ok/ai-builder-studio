"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createProjectDraft } from "@/app/actions/project";
import { useRouter } from "next/navigation";

export default function CreateProjectPage() {
  const router = useRouter();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please provide a project name.");
      return;
    }
    
    setLoading(true);
    try {
      await createProjectDraft({
        name,
        description,
        provider,
        model
      });
      alert("Project saved as Draft. The AI generation backend pipeline is not yet implemented in Phase 3.");
      router.push("/dashboard/projects");
    } catch (err: any) {
      alert(err.message || "Failed to generate project");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 w-full max-w-[960px] mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-140px)] py-xl md:py-12">
      <form onSubmit={handleGenerate} className="w-full max-w-3xl space-y-xl">
        
        {/* Header */}
        <div className="text-center space-y-sm">
          <h2 className="font-display-lg text-display-lg text-on-surface tracking-tight">What are we building today?</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-prose mx-auto">Describe your vision. ABS will scaffold the architecture, connect providers, and generate the foundation.</p>
        </div>

        {/* Main Prompt Editor Area */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 transition-all duration-300 shadow-lg shadow-black/50">
          <textarea 
            className="w-full h-40 bg-transparent text-on-surface font-headline-sm text-headline-sm resize-none outline-none placeholder:text-on-surface-variant/40 p-sm leading-relaxed" 
            placeholder="Build a high-performance analytics dashboard for tracking SaaS metrics..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          ></textarea>
          
          <div className="flex items-center justify-between mt-sm border-t border-surface-container-highest pt-sm px-sm">
            <div className="flex items-center gap-sm">
              <button type="button" className="text-on-surface-variant hover:text-on-surface transition-colors p-xs rounded" title="Attach context">
                <span className="material-symbols-outlined text-[20px]">attach_file</span>
              </button>
              <button type="button" className="text-on-surface-variant hover:text-on-surface transition-colors p-xs rounded" title="Use Voice">
                <span className="material-symbols-outlined text-[20px]">mic</span>
              </button>
            </div>
            <div className="font-code-md text-code-md text-on-surface-variant/50">
              {description.length} / 2000
            </div>
          </div>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md mt-xl">
          <div className="space-y-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider pl-xs block">Project Name *</label>
            <input 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-surface-container-highest rounded text-on-surface font-body-md text-body-md px-md py-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
              placeholder="e.g., Nexus Dashboard" 
              type="text" 
            />
          </div>
          
          <div className="space-y-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider pl-xs block">AI Provider</label>
            <div className="relative">
              <select 
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-surface-container-highest rounded text-on-surface font-body-md text-body-md pl-10 pr-md py-sm appearance-none outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
              <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">smart_toy</span>
              <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>

        {/* Primary Action */}
        <div className="pt-xl flex justify-center">
          <Button type="submit" disabled={loading} className="py-md px-xl gap-sm h-auto text-base shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            <span className="font-headline-sm text-headline-sm tracking-wide">
              {loading ? "Preparing Pipeline..." : "Generate Project"}
            </span>
          </Button>
        </div>
        
      </form>
    </div>
  );
}
