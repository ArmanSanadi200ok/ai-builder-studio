import { auth } from "@/auth";
import { db } from "@/db";
import { userSettings, userIntegrations } from "@/db/schema/settings";
import { userApiKeys } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SettingsTabs } from "./components/SettingsTabs";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.user.id),
  });

  const apiKeys = await db.query.userApiKeys.findMany({
    where: eq(userApiKeys.userId, session.user.id),
  });

  const integrations = await db.query.userIntegrations.findMany({
    where: eq(userIntegrations.userId, session.user.id),
  });

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">Settings</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Manage your preferences, API keys, and integrations.</p>
      </header>

      <SettingsTabs 
        settings={settings || {}} 
        apiKeys={apiKeys.map(k => ({ provider: k.provider, hasKey: true }))}
        integrations={integrations.map(i => ({ provider: i.provider }))}
      />
    </div>
  );
}
