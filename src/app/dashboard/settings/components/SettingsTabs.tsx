"use client";

import { useState } from "react";
import { AIPreferencesTab } from "./AIPreferencesTab";
import { APIKeysTab } from "./APIKeysTab";
import { IntegrationsTab } from "./IntegrationsTab";

export function SettingsTabs({ settings, apiKeys, integrations }: { settings: any, apiKeys: any[], integrations: any[] }) {
  const [activeTab, setActiveTab] = useState("ai-preferences");

  const tabs = [
    { id: "ai-preferences", label: "AI Preferences" },
    { id: "api-keys", label: "API Keys" },
    { id: "integrations", label: "Integrations" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 border-b border-outline-variant/30 pb-2 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-label-lg rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? "bg-surface-container border-b-2 border-primary text-primary" 
                : "text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-container rounded-b-xl rounded-tr-xl p-lg border border-outline-variant/30 min-h-[400px]">
        {activeTab === "ai-preferences" && <AIPreferencesTab settings={settings} />}
        {activeTab === "api-keys" && <APIKeysTab apiKeys={apiKeys} />}
        {activeTab === "integrations" && <IntegrationsTab integrations={integrations} />}
      </div>
    </div>
  );
}
