import { auth } from "@/auth";
import { db } from "@/db";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;

  const userId = session!.user!.id as string;

  // Fetch actual counts for the current user
  const [projectsCount, apiKeysCount] = await Promise.all([
    db.query.projects.findMany({ where: (projects, { eq }) => eq(projects.userId, userId) }).then(res => res.length),
    db.query.userApiKeys.findMany({ where: (userApiKeys, { eq }) => eq(userApiKeys.userId, userId) }).then(res => res.length)
  ]);
  
  // For integrations, we count if they have connected github or vercel etc.
  // We can look at accounts table if NextAuth stores them there, or just check user fields if we stored them.
  // Using NextAuth accounts table:
  const accounts = await db.query.accounts.findMany({ where: (accounts, { eq }) => eq(accounts.userId, userId) });
  const activeIntegrationsCount = accounts.length;

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">
          Welcome back, {user?.name || "Developer"}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Here's what's happening with your projects today.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        <div className="bg-surface-container rounded-xl p-md border border-outline-variant/30 flex flex-col gap-2">
          <span className="material-symbols-outlined text-primary text-[24px]">folder_open</span>
          <h3 className="font-label-lg text-label-lg text-on-surface">Total Projects</h3>
          <p className="font-headline-lg text-headline-lg text-on-surface">{projectsCount}</p>
        </div>
        
        <div className="bg-surface-container rounded-xl p-md border border-outline-variant/30 flex flex-col gap-2">
          <span className="material-symbols-outlined text-secondary text-[24px]">hub</span>
          <h3 className="font-label-lg text-label-lg text-on-surface">Active Integrations</h3>
          <p className="font-headline-lg text-headline-lg text-on-surface">{activeIntegrationsCount}</p>
        </div>
        
        <div className="bg-surface-container rounded-xl p-md border border-outline-variant/30 flex flex-col gap-2">
          <span className="material-symbols-outlined text-tertiary text-[24px]">api</span>
          <h3 className="font-label-lg text-label-lg text-on-surface">API Keys Configured</h3>
          <p className="font-headline-lg text-headline-lg text-on-surface">{apiKeysCount}</p>
        </div>
      </div>
      
      {projectsCount === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-outline-variant/30 rounded-lg h-64 text-on-surface-variant mt-6">
          <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">architecture</span>
          <p>No projects yet. Get started by creating your first AI application.</p>
        </div>
      )}
    </div>
  );
}
