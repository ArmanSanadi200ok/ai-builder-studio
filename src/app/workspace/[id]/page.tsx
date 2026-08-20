import { WorkspaceLayout } from "@/components/layout/WorkspaceLayout";
import { auth } from "@/auth";
import { db } from "@/db";
import { projects } from "@/db/schema/projects";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

export default async function WorkspacePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, params.id),
  });

  if (!project) return notFound();
  
  // Authorization: Only owner can access
  if (project.userId !== session.user.id) return notFound();

  return (
    <WorkspaceLayout project={project}>
      <div className="w-full max-w-[1024px] bg-[#0f0f11] rounded-xl border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col min-h-[600px] ring-1 ring-white/5">
        <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-8 text-center">
          <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">design_services</span>
          <h2 className="font-headline-sm text-on-surface mb-2">Live Application Preview</h2>
          <p className="text-sm max-w-md">
            This canvas will render your generated application when the AI completes the initial draft.
          </p>
          {project.status === "draft" && (
            <div className="mt-6 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm">
              Waiting for generation to begin...
            </div>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
