export interface AIProviderConfig {
  id: string;
  name: string;
  requiresKey: boolean;
  defaultModels: string[];
  // testKey takes the API key (and optional endpoint for ollama) and returns true if valid
  testKey: (key: string, endpoint?: string) => Promise<boolean>;
  getModels?: (key: string, endpoint?: string) => Promise<string[]>;
}

export const aiProviders: Record<string, AIProviderConfig> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    requiresKey: true,
    defaultModels: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    testKey: async (key: string) => {
      try {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    requiresKey: true,
    defaultModels: ["claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
    testKey: async (key: string) => {
      try {
        // Anthropic models endpoint or a simple ping
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: { 
            "x-api-key": key,
            "anthropic-version": "2023-06-01"
          },
        });
        // Wait, anthropic models endpoint might return 404 depending on API version, 
        // a simple test is testing authentication.
        // Actually Anthropic requires hitting messages with max_tokens=1
        return res.status !== 401 && res.status !== 403;
      } catch {
        return false;
      }
    },
  },
  google: {
    id: "google",
    name: "Google Gemini",
    requiresKey: true,
    defaultModels: ["gemini-1.5-pro", "gemini-1.5-flash"],
    testKey: async (key: string) => {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        return res.ok;
      } catch {
        return false;
      }
    },
  },
  groq: {
    id: "groq",
    name: "Groq",
    requiresKey: true,
    defaultModels: ["llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768"],
    testKey: async (key: string) => {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    requiresKey: true,
    defaultModels: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "meta-llama/llama-3-70b-instruct"],
    testKey: async (key: string) => {
      try {
        // We can hit auth/key
        const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    requiresKey: true,
    defaultModels: ["deepseek-chat", "deepseek-coder"],
    testKey: async (key: string) => {
      try {
        const res = await fetch("https://api.deepseek.com/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    requiresKey: true,
    defaultModels: ["mistral-large-latest", "mistral-small-latest", "open-mixtral-8x22b"],
    testKey: async (key: string) => {
      try {
        const res = await fetch("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    requiresKey: true,
    defaultModels: ["llama3.1-70b", "llama3.1-8b"],
    testKey: async (key: string) => {
      try {
        const res = await fetch("https://api.cerebras.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  },
  together: {
    id: "together",
    name: "Together AI",
    requiresKey: true,
    defaultModels: ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"],
    testKey: async (key: string) => {
      try {
        const res = await fetch("https://api.together.xyz/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    requiresKey: false,
    defaultModels: ["llama3", "mistral"],
    testKey: async (_, endpoint: string = "http://localhost:11434") => {
      try {
        // Just ping the tags endpoint
        const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/tags`);
        return res.ok;
      } catch {
        return false;
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
    requiresKey: true,
    defaultModels: ["default"],
    testKey: async (key: string, endpoint: string = "") => {
      if (!endpoint) return false;
      try {
        const res = await fetch(`${endpoint.replace(/\/$/, '')}/models`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  }
};
