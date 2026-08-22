export interface AIProviderConfig {
  id: string;
  name: string;
  category: "personal" | "abs";
  requiresKey: boolean;
  defaultModels: string[];
  testKey: (key: string, endpoint?: string) => Promise<{ valid: boolean; error?: string }>;
  getModels?: (key: string, endpoint?: string) => Promise<string[]>;
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

export const aiProviders: Record<string, AIProviderConfig> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    category: "personal",
    requiresKey: true,
    defaultModels: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    testKey: async (key: string) => handleFetchTest("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` }),
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
          let errText = await res.text();
          try {
            const j = JSON.parse(errText);
            errText = j.error?.message || errText;
          } catch(e) {}
          return { valid: false, error: `HTTP ${res.status}: ${errText.slice(0, 150)}` };
        }
        return { valid: true };
      } catch (err: any) {
        return { valid: false, error: err.message || "Network error" };
      }
    },
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
        let errText = await res.text();
        try {
          const j = JSON.parse(errText);
          errText = j.error?.message || errText;
        } catch(e){}
        return { valid: false, error: `HTTP ${res.status}: ${errText.slice(0, 150)}` };
      } catch (err: any) {
        return { valid: false, error: err.message || "Network error" };
      }
    },
  },
  groq: {
    id: "groq",
    name: "Groq",
    category: "personal",
    requiresKey: true,
    defaultModels: ["llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768"],
    testKey: async (key: string) => handleFetchTest("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${key}` }),
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    category: "personal",
    requiresKey: true,
    defaultModels: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "meta-llama/llama-3-70b-instruct"],
    testKey: async (key: string) => handleFetchTest("https://openrouter.ai/api/v1/auth/key", { Authorization: `Bearer ${key}` }),
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    category: "personal",
    requiresKey: true,
    defaultModels: ["deepseek-chat", "deepseek-coder"],
    testKey: async (key: string) => handleFetchTest("https://api.deepseek.com/models", { Authorization: `Bearer ${key}` }),
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    category: "personal",
    requiresKey: true,
    defaultModels: ["mistral-large-latest", "mistral-small-latest", "open-mixtral-8x22b"],
    testKey: async (key: string) => handleFetchTest("https://api.mistral.ai/v1/models", { Authorization: `Bearer ${key}` }),
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    category: "personal",
    requiresKey: true,
    defaultModels: ["llama3.1-70b", "llama3.1-8b"],
    testKey: async (key: string) => handleFetchTest("https://api.cerebras.ai/v1/models", { Authorization: `Bearer ${key}` }),
  },
  together: {
    id: "together",
    name: "Together AI",
    category: "personal",
    requiresKey: true,
    defaultModels: ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"],
    testKey: async (key: string) => handleFetchTest("https://api.together.xyz/v1/models", { Authorization: `Bearer ${key}` }),
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    category: "personal",
    requiresKey: false,
    defaultModels: ["llama3", "mistral"],
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
        return data.models?.map((m: any) => m.name) || [];
      } catch {
        return [];
      }
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
