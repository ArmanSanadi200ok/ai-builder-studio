import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="flex flex-col gap-6">
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
          <p className="font-headline-lg text-headline-lg text-on-surface">0</p>
        </div>
        
        <div className="bg-surface-container rounded-xl p-md border border-outline-variant/30 flex flex-col gap-2">
          <span className="material-symbols-outlined text-secondary text-[24px]">hub</span>
          <h3 className="font-label-lg text-label-lg text-on-surface">Active Integrations</h3>
          <p className="font-headline-lg text-headline-lg text-on-surface">0</p>
        </div>
        
        <div className="bg-surface-container rounded-xl p-md border border-outline-variant/30 flex flex-col gap-2">
          <span className="material-symbols-outlined text-tertiary text-[24px]">api</span>
          <h3 className="font-label-lg text-label-lg text-on-surface">API Keys Configured</h3>
          <p className="font-headline-lg text-headline-lg text-on-surface">0</p>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-outline-variant/30 rounded-lg h-64 text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">architecture</span>
        <p>No projects yet. Get started by creating your first AI application.</p>
      </div>
    </div>
  );
}
