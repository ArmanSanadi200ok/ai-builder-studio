"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { userApiKeys, users } from "@/db/schema/users";
import { userSettings } from "@/db/schema/settings";
import { eq, and } from "drizzle-orm";
import { encryptKey } from "@/lib/encryption";
import { aiProviders } from "@/lib/ai/registry";
import { revalidatePath } from "next/cache";
import { decryptKey } from "@/lib/encryption";

export async function saveApiKey(provider: string, key: string, endpoint?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const aiProvider = aiProviders[provider];
  if (!aiProvider) return { success: false, error: "Invalid provider" };

  // Validate/test the key server-side first
  const { valid, error } = await aiProvider.testKey(key, endpoint);
  if (!valid) {
    return { success: false, error: error ? `API Error: ${error}` : `Invalid API key for ${aiProvider.name}. Connection test failed.` };
  }

  // Encrypt
  const { encryptedKey, iv } = encryptKey(key);

  // Check if exists
  const existing = await db.query.userApiKeys.findFirst({
    where: and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, provider)),
  });

  if (existing) {
    await db
      .update(userApiKeys)
      .set({ encryptedKey, iv, updatedAt: new Date() })
      .where(eq(userApiKeys.id, existing.id));
  } else {
    await db.insert(userApiKeys).values({
      userId: session.user.id,
      provider,
      encryptedKey,
      iv,
    });
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function deleteApiKey(provider: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db
    .delete(userApiKeys)
    .where(and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, provider)));

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function updateUserSettings(data: {
  defaultProvider?: string;
  defaultModel?: string;
  ollamaEndpoint?: string;
  aiFallbacks?: string[];
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.user.id),
  });

  if (existing) {
    await db
      .update(userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSettings.userId, session.user.id));
  } else {
    await db.insert(userSettings).values({
      userId: session.user.id,
      defaultProvider: data.defaultProvider || "openai",
      defaultModel: data.defaultModel || "gpt-4o",
      ollamaEndpoint: data.ollamaEndpoint || "http://localhost:11434",
      aiFallbacks: data.aiFallbacks || [],
    });
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function updateProfile(name: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db
    .update(users)
    .set({ name })
    .where(eq(users.id, session.user.id));

  // Note: changing name doesn't auto-update the session cookie immediately unless jwt callback is handled,
  // but it will update in db and next fetch will show it.
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function deleteAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Since tables have onDelete: cascade to users.id, this deletes everything for the user
  await db.delete(users).where(eq(users.id, session.user.id));
  return { success: true };
}

export async function getAvailableModels(providerId: string, endpoint?: string) {
  const session = await auth();
  if (!session?.user?.id) return aiProviders[providerId]?.defaultModels || [];

  const provider = aiProviders[providerId];
  if (!provider) return [];

  // If provider has getModels, try to fetch dynamically
  if (provider.getModels) {
    try {
      let key = "";
      if (provider.requiresKey) {
        const apiKeyRecord = await db.query.userApiKeys.findFirst({
          where: and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, providerId)),
        });
        if (apiKeyRecord) {
          key = decryptKey(apiKeyRecord.encryptedKey, apiKeyRecord.iv);
        } else {
          // If requires key but none configured, return defaults
          return provider.defaultModels;
        }
      }
      const discovered = await provider.getModels(key, endpoint);
      if (discovered && discovered.length > 0) {
        return discovered;
      }
    } catch (err) {
      console.error("Failed to discover models", err);
    }
  }

  // Fallback to defaults
  return provider.defaultModels;
}
