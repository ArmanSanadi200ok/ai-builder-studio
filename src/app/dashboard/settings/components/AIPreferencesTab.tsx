"use client";

import { useState, useEffect } from "react";
import { updateUserSettings, getAvailableModels } from "@/app/actions/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { aiProviders } from "@/lib/ai/registry";

export function AIPreferencesTab({ settings }: { settings: any }) {
  const [provider, setProvider] = useState(settings?.defaultProvider || "openai");
  const [model, setModel] = useState(settings?.defaultModel || "gpt-4o");
  const [ollamaEndpoint, setOllamaEndpoint] = useState(settings?.ollamaEndpoint || "http://localhost:11434");
  const [loading, setLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchModels() {
      setLoadingModels(true);
      try {
        const models = await getAvailableModels(provider, ollamaEndpoint);
        if (active) {
          setAvailableModels(models);
          if (!models.includes(model) && models.length > 0) {
            setModel(models[0]);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoadingModels(false);
      }
    }
    fetchModels();
    return () => { active = false; };
  }, [provider, ollamaEndpoint]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await updateUserSettings({ defaultProvider: provider, defaultModel: model, ollamaEndpoint });
      alert("AI Preferences saved");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedProviderConfig = aiProviders[provider] || aiProviders["openai"];

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-lg">
      <div>
        <h2 className="font-headline-sm text-on-surface mb-4">Default Generation Models</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-label-md text-on-surface mb-1 block">Default Provider</label>
            <select 
              value={provider} 
              onChange={(e) => {
                setProvider(e.target.value);
                setModel(aiProviders[e.target.value]?.defaultModels[0] || "");
              }}
              className="w-full bg-surface-container-high border border-outline-variant/50 text-on-surface text-body-md rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none truncate"
            >
              {Object.values(aiProviders).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            {provider === "ollama" ? (
              <div className="flex flex-col gap-2">
                <select 
                  value={model} 
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/50 text-on-surface text-body-md rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none truncate"
                  disabled={loadingModels}
                >
                  <option value="">{loadingModels ? "Loading models..." : "Select a model"}</option>
                  {availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <p className="text-xs text-on-surface-variant">Or enter manually below if not listed:</p>
                <Input 
                  value={model} 
                  onChange={(e) => setModel(e.target.value)} 
                  placeholder="e.g. llama3"
                />
              </div>
            ) : (
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/50 text-on-surface text-body-md rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none truncate"
                disabled={loadingModels}
              >
                {loadingModels ? <option>Loading...</option> : availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>

          {provider === "ollama" && (
            <div>
              <label className="font-label-md text-on-surface mb-1 block">Ollama Endpoint</label>
              <Input 
                value={ollamaEndpoint} 
                onChange={(e) => setOllamaEndpoint(e.target.value)} 
                placeholder="http://localhost:11434"
              />
            </div>
          )}
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-fit">
        {loading ? "Saving..." : "Save Preferences"}
      </Button>
    </form>
  );
}
