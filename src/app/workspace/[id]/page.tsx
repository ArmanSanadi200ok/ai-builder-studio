import { WorkspaceLayout } from "@/components/layout/WorkspaceLayout";

export default function WorkspacePage() {
  return (
    <WorkspaceLayout>
      <div className="w-full max-w-[1024px] bg-[#0f0f11] rounded-xl border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col min-h-[600px] ring-1 ring-white/5">
        <div className="flex-1 flex items-center justify-center text-on-surface-variant">
          Workspace Canvas Placeholder
        </div>
      </div>
    </WorkspaceLayout>
  );
}
