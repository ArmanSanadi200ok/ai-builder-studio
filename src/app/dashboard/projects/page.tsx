import { auth } from "@/auth";
import { db } from "@/db";
import { projects } from "@/db/schema/projects";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { aiProviders } from "@/lib/ai/registry";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const userProjects = await db.query.projects.findMany({
    where: eq(projects.userId, session.user.id),
    orderBy: [desc(projects.updatedAt)],
  });

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Projects</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Your generated applications and active deployments.
          </p>
        </div>
        <Link href="/dashboard/create">
          <Button>New App</Button>
        </Link>
      </header>

      {userProjects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-outline-variant/30 rounded-lg h-64 text-on-surface-variant bg-surface-container-lowest mt-4">
          <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">architecture</span>
          <h3 className="font-headline-sm text-on-surface mb-2">No projects yet</h3>
          <p className="font-body-sm text-on-surface-variant mb-6 text-center max-w-sm">
            Create your first AI-powered project. ABS will scaffold the architecture and connect your providers.
          </p>
          <Link href="/dashboard/create">
            <Button>Generate Project</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {userProjects.map((project) => {
            const isReady = project.status === "ready" || project.status === "deployed";
            const providerInfo = project.selectedProvider ? aiProviders[project.selectedProvider] : null;
            const categoryText = providerInfo?.category === "abs" ? "ABS AI" : "Personal LLM";
            const providerName = providerInfo?.name || project.selectedProvider || "Unknown Provider";
            
            return (
              <div key={project.id} className="bg-surface-container rounded-xl p-md border border-outline-variant/30 flex flex-col justify-between group hover:border-primary/50 transition-colors">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-headline-sm text-on-surface truncate pr-2" title={project.name}>{project.name}</h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full shrink-0 ${
                      project.status === "deployed" ? "bg-primary/20 text-primary" :
                      project.status === "failed" ? "bg-error/10 text-error" :
                      "bg-surface-container-highest text-on-surface-variant"
                    }`}>
                      {project.status}
                    </span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant mb-4 line-clamp-2 min-h-[40px]">
                    {project.description || "No description provided."}
                  </p>
                  
                  <div className="flex flex-col gap-2 mb-4 text-xs text-on-surface-variant border-t border-outline-variant/10 pt-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      Updated {project.updatedAt.toLocaleDateString()}
                    </div>
                    {project.selectedProvider && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-on-surface-variant/70">
                          {categoryText}
                        </div>
                        <div className="flex items-center gap-2 font-medium text-on-surface">
                          <span className="material-symbols-outlined text-[14px]">
                            {providerInfo?.category === "abs" ? "architecture" : "smart_toy"}
                          </span>
                          {providerName}
                        </div>
                        <div className="flex items-center gap-2 ml-5 text-on-surface-variant/80">
                          {project.selectedModel}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-2 pt-4 border-t border-outline-variant/20 flex gap-2">
                  <Link href={`/workspace/${project.id}`} className="flex-1">
                    <Button variant={isReady ? "primary" : "secondary"} className="w-full justify-center">
                      Open Workspace
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
