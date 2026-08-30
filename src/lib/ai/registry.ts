export interface ProviderModel {
  id: string;
  name: string;
  provider: string;
  capabilities?: string[];
  contextWindow?: number;
  isFree?: boolean;
  isAvailable: boolean;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  category: "personal" | "abs";
  requiresKey: boolean;
  defaultModels: string[];
  testKey: (key: string, endpoint?: string) => Promise<{ valid: boolean; error?: string }>;
  getModels?: (key: string, endpoint?: string) => Promise<ProviderModel[]>;
}

async function handleFetchTest(url: string, headers: any): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(url, { headers });
    if (res.ok) return { valid: true };
    
    let errText = await res.text();
    try {
      const j = JSON.parse(errText);
      errText = j.error?.message || j.message || errText;
    } catch (e) {}
    
    return { valid: false, error: `HTTP ${res.status}: ${errText.slice(0, 150)}` };
  } catch (err: any) {
    return { valid: false, error: err.message || "Network error" };
  }
}

// In-memory cache for live models
const modelCache = new Map<string, { models: ProviderModel[], timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function getLiveModels(providerId: string, apiKey: string, endpoint?: string): Promise<ProviderModel[]> {
  const cacheKey = `${providerId}-${apiKey.slice(0, 5)}`;
  const cached = modelCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.models;
  }

  const provider = aiProviders[providerId];
  if (!provider || !provider.getModels) {
    // If provider doesn't support getModels, return default models
    const models = provider?.defaultModels.map(id => ({
      id,
      name: id,
      provider: providerId,
      isAvailable: true,
    })) || [];
    return models;
  }

  const models = await provider.getModels(apiKey, endpoint);
  modelCache.set(cacheKey, { models, timestamp: Date.now() });
  return models;
}

export const aiProviders: Record<string, AIProviderConfig> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    category: "personal",
    requiresKey: true,
    defaultModels: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    testKey: async (key: string) => handleFetchTest("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` }),
    getModels: async (key: string) => {
      try {
        const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.id,
          provider: "openai",
          isAvailable: true,
        })).filter((m: any) => m.id.includes("gpt"));
      } catch { return []; }
    }
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    category: "personal",
    requiresKey: true,
    defaultModels: ["claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
    testKey: async (key: string) => {
      try {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
        });
        if (res.status === 401 || res.status === 403) {
          return { valid: false, error: `HTTP ${res.status}` };
        }
        return { valid: true };
      } catch (err: any) {
        return { valid: false, error: err.message };
      }
    },
    getModels: async (key: string) => {
      try {
        const res = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.display_name || m.id,
          provider: "anthropic",
          isAvailable: true,
        }));
      } catch { return []; }
    }
  },
  google: {
    id: "google",
    name: "Google Gemini",
    category: "personal",
    requiresKey: true,
    defaultModels: ["gemini-1.5-pro", "gemini-1.5-flash"],
    testKey: async (key: string) => {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (res.ok) return { valid: true };
        return { valid: false };
      } catch { return { valid: false }; }
    },
    getModels: async (key: string) => {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.models || []).map((m: any) => ({
          id: m.name.replace('models/', ''),
          name: m.displayName,
          provider: "google",
          isAvailable: true,
        })).filter((m: any) => m.id.includes("gemini"));
      } catch { return []; }
    }
  },
  groq: {
    id: "groq",
    name: "Groq",
    category: "personal",
    requiresKey: true,
    defaultModels: [],
    testKey: async (key: string) => handleFetchTest("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${key}` }),
    getModels: async (key: string) => {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || [])
          .filter((m: any) => !m.id.includes("whisper") && !m.id.includes("audio"))
          .map((m: any) => ({
            id: m.id,
            name: m.id,
            provider: "groq",
            isAvailable: true,
          }));
      } catch { return []; }
    },
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    category: "personal",
    requiresKey: true,
    defaultModels: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o"],
    testKey: async (key: string) => handleFetchTest("https://openrouter.ai/api/v1/auth/key", { Authorization: `Bearer ${key}` }),
    getModels: async (key: string) => {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          provider: "openrouter",
          isFree: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
          isAvailable: true,
        }));
      } catch { return []; }
    },
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    category: "personal",
    requiresKey: true,
    defaultModels: ["deepseek-chat"],
    testKey: async (key: string) => handleFetchTest("https://api.deepseek.com/models", { Authorization: `Bearer ${key}` }),
    getModels: async (key: string) => {
      try {
        const res = await fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.id,
          provider: "deepseek",
          isAvailable: true,
        }));
      } catch { return []; }
    }
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    category: "personal",
    requiresKey: true,
    defaultModels: ["mistral-large-latest"],
    testKey: async (key: string) => handleFetchTest("https://api.mistral.ai/v1/models", { Authorization: `Bearer ${key}` }),
    getModels: async (key: string) => {
      try {
        const res = await fetch("https://api.mistral.ai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.id,
          provider: "mistral",
          isAvailable: true,
        }));
      } catch { return []; }
    }
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    category: "personal",
    requiresKey: true,
    defaultModels: ["llama3.1-70b"],
    testKey: async (key: string) => handleFetchTest("https://api.cerebras.ai/v1/models", { Authorization: `Bearer ${key}` }),
    getModels: async (key: string) => {
      try {
        const res = await fetch("https://api.cerebras.ai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.id,
          provider: "cerebras",
          isAvailable: true,
        }));
      } catch { return []; }
    }
  },
  together: {
    id: "together",
    name: "Together AI",
    category: "personal",
    requiresKey: true,
    defaultModels: ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"],
    testKey: async (key: string) => handleFetchTest("https://api.together.xyz/v1/models", { Authorization: `Bearer ${key}` }),
    getModels: async (key: string) => {
      try {
        const res = await fetch("https://api.together.xyz/v1/models", { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).filter((m: any) => m.type === "chat").map((m: any) => ({
          id: m.id,
          name: m.display_name || m.id,
          provider: "together",
          isAvailable: true,
        }));
      } catch { return []; }
    }
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    category: "personal",
    requiresKey: false,
    defaultModels: ["llama3"],
    testKey: async (_, endpoint: string = "http://localhost:11434") => {
      try {
        const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/tags`);
        if (res.ok) return { valid: true };
        return { valid: false, error: `HTTP ${res.status}` };
      } catch (err: any) {
        return { valid: false, error: err.message || "Network error" };
      }
    },
    getModels: async (_, endpoint: string = "http://localhost:11434") => {
      try {
        const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/tags`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.models || []).map((m: any) => ({
          id: m.name,
          name: m.name,
          provider: "ollama",
          isAvailable: true,
        }));
      } catch { return []; }
    }
  },
  custom: {
    id: "custom",
    name: "Custom (OpenAI Compatible)",
    category: "personal",
    requiresKey: true,
    defaultModels: ["default"],
    testKey: async (key: string, endpoint: string = "") => {
      if (!endpoint) return { valid: false, error: "Endpoint required" };
      return handleFetchTest(`${endpoint.replace(/\/$/, '')}/models`, { Authorization: `Bearer ${key}` });
    },
  },
  "abs-fast": {
    id: "abs-fast",
    name: "ABS Fast",
    category: "abs",
    requiresKey: false,
    defaultModels: ["abs-fast-v1"],
    testKey: async () => ({ valid: true }),
  },
  "abs-pro": {
    id: "abs-pro",
    name: "ABS Pro",
    category: "abs",
    requiresKey: false,
    defaultModels: ["abs-pro-v1"],
    testKey: async () => ({ valid: true }),
  },
  "abs-reasoning": {
    id: "abs-reasoning",
    name: "ABS Reasoning",
    category: "abs",
    requiresKey: false,
    defaultModels: ["abs-reasoning-v1"],
    testKey: async () => ({ valid: true }),
  }
};
