import { auth } from "@/auth";
import { db } from "@/db";
import { userApiKeys } from "@/db/schema/users";
import { userSettings } from "@/db/schema/settings";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { aiProviders } from "@/lib/ai/registry";
import { CreateProjectForm, ProviderOption } from "./CreateProjectForm";

export default async function CreateProjectPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  // Fetch configured keys
  const configuredKeys = await db.query.userApiKeys.findMany({
    where: eq(userApiKeys.userId, session.user.id),
  });
  const configuredProvidersSet = new Set(configuredKeys.map(k => k.provider));

  // Fetch user settings for defaults
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.user.id),
  });

  const allProviders = Object.values(aiProviders);
  
  // Filter Personal LLMs (only if explicitly configured)
  const personalProviders: ProviderOption[] = allProviders
    .filter(p => p.category === "personal" && configuredProvidersSet.has(p.id))
    .map(p => ({
      id: p.id,
      name: p.name,
      category: "personal",
      defaultModels: p.defaultModels,
    }));

  // Filter ABS providers
  const absProviders: ProviderOption[] = allProviders
    .filter(p => p.category === "abs")
    .map(p => ({
      id: p.id,
      name: p.name,
      category: "abs",
      defaultModels: p.defaultModels,
    }));

  return (
    <CreateProjectForm 
      personalProviders={personalProviders} 
      absProviders={absProviders} 
      defaultProvider={settings?.defaultProvider || "openai"}
      defaultModel={settings?.defaultModel || "gpt-4o"}
    />
  );
}
