import { auth } from "@/auth";
import { db } from "@/db";
import { userSettings, userIntegrations } from "@/db/schema/settings";
import { userApiKeys, accounts } from "@/db/schema/users";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SettingsTabs } from "./components/SettingsTabs";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const userId = session.user.id;

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  const apiKeys = await db.query.userApiKeys.findMany({
    where: eq(userApiKeys.userId, userId),
  });

  const integrations = await db.query.userIntegrations.findMany({
    where: eq(userIntegrations.userId, userId),
  });

  const githubAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.userId, userId),
      eq(accounts.provider, "github")
    ),
  });

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">Settings</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Manage your preferences, API keys, and integrations.</p>
      </header>

      <SettingsTabs 
        settings={settings ? { 
          defaultProvider: settings.defaultProvider, 
          defaultModel: settings.defaultModel, 
          ollamaEndpoint: settings.ollamaEndpoint,
          aiFallbacks: settings.aiFallbacks
        } : {}} 
        apiKeys={apiKeys.map(k => ({ provider: k.provider, hasKey: true }))}
        integrations={integrations.map(i => ({ provider: i.provider }))}
        isGithubConnected={!!githubAccount}
        envConfigured={{
          github: !!process.env.AUTH_GITHUB_ID,
          vercel: !!process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID
        }}
      />
    </div>
  );
}
