import { config } from "dotenv";
config({ path: ".env.local" });

import { executeWithProviderChain, AttemptRecord } from "./src/lib/ai/provider-chain";
import { NonRetriableError } from "inngest";
import * as providerChainLib from "./src/lib/ai/provider-chain";

// Mocking dependencies to test fallback logic
const mockGetDecryptedKey = async (providerId: string, userId: string) => "mock-key";
Object.defineProperty(providerChainLib, 'getDecryptedKey', { value: mockGetDecryptedKey });

const db = {
  update: () => ({
    set: () => ({
      where: () => Promise.resolve()
    })
  })
};

// Test 1: Provider Fallback
async function testFallback() {
  console.log("Running Provider Fallback Test...");
  const providerChain = [
    { providerId: "cerebras", modelId: "gpt-oss-120b" },
    { providerId: "openrouter", modelId: "openrouter-model" },
    { providerId: "groq", modelId: "groq-model" }
  ];

  let requestCount = 0;
  
  // Override makeProviderRequest to mock 402, 429, then success
  Object.defineProperty(providerChainLib, 'makeProviderRequest', {
    value: async (providerId: string, modelId: string) => {
      requestCount++;
      if (providerId === "cerebras") throw { status: 402, message: "Payment Required" };
      if (providerId === "openrouter") throw { status: 500, message: "Internal Server Error" };
      if (providerId === "groq") return "SUCCESS JSON";
      return "";
    },
    writable: true
  });
  
  // Also mock db inside the tested module
  // Actually, executeWithProviderChain imports db from @/db directly, we can't easily mock it without jest.
  // But wait! We can just run a real test against the database for the fallback by creating a fake job!
}
testFallback();
