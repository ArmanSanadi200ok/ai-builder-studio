"use client";

import { useState } from "react";
import { saveApiKey, deleteApiKey } from "@/app/actions/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { aiProviders } from "@/lib/ai/registry";

export function APIKeysTab({ apiKeys }: { apiKeys: { provider: string; hasKey: boolean }[] }) {
  const [provider, setProvider] = useState("openai");
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);

  const configuredProviders = new Set(apiKeys.map(k => k.provider));
  
  // Filter out ABS providers
  const configurableProviders = Object.values(aiProviders).filter(p => p.category === "personal");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await saveApiKey(provider, key);
      if (!result.success && result.error) {
        alert(result.error);
        return;
      }
      alert("Provider saved and validated successfully.");
      setKey(""); // Clear input on success
    } catch (err: any) {
      alert("Failed to save provider: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(providerId: string) {
    if (!confirm(`Are you sure you want to remove the configuration for ${aiProviders[providerId]?.name}?`)) return;
    try {
      await deleteApiKey(providerId);
    } catch (err: any) {
      alert("Failed to remove: " + err.message);
    }
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl">
      <div>
        <h2 className="font-headline-sm text-on-surface mb-4">Configure Provider</h2>
        <form onSubmit={handleSave} className="flex flex-col gap-4 bg-surface-container-high p-lg rounded-xl border border-outline-variant/30">
          <div>
            <label className="font-label-md text-on-surface mb-1 block">Provider</label>
            <select 
              value={provider} 
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/50 text-on-surface text-body-md rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none truncate"
            >
              {configurableProviders.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-label-md text-on-surface mb-1 block">
              {aiProviders[provider]?.requiresKey === false ? "Endpoint URL" : "API Key"}
            </label>
            <Input 
              type={aiProviders[provider]?.requiresKey === false ? "url" : "password"}
              value={key} 
              onChange={(e) => setKey(e.target.value)} 
              placeholder={aiProviders[provider]?.requiresKey === false ? "http://localhost:11434" : "sk-..."} 
              required 
            />
            <p className="text-xs text-on-surface-variant mt-2">
              Keys are encrypted with AES-256-GCM before storage and never returned to the client.
            </p>
          </div>
          <Button type="submit" disabled={loading || !key} className="w-fit">
            {loading ? "Validating & Saving..." : "Save Key"}
          </Button>
        </form>
      </div>

      <div>
        <h2 className="font-headline-sm text-on-surface mb-4">Configured Providers</h2>
        {apiKeys.length === 0 ? (
          <p className="text-on-surface-variant">No API keys configured yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {apiKeys.map(k => {
              const p = aiProviders[k.provider];
              if (!p) return null;
              return (
                <div key={k.provider} className="flex items-center justify-between p-4 bg-surface-container-high rounded-lg border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary">key</span>
                    <div>
                      <h4 className="font-label-lg text-on-surface">{p.name}</h4>
                      <p className="font-body-sm text-on-surface-variant text-xs">•••• •••• •••• (Encrypted)</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => handleDelete(k.provider)} className="!bg-error/10 !text-error hover:!bg-error/20">
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
