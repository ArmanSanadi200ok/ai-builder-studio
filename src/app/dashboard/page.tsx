export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">Welcome back, Developer</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Here's what's happening with your projects today.</p>
      </header>
      <div className="flex-1 flex items-center justify-center border border-dashed border-outline-variant/30 rounded-lg h-64 text-on-surface-variant">
        Dashboard Content Placeholder
      </div>
    </div>
  );
}
