import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import Link from "next/link";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden font-body-md text-body-md bg-surface-container-lowest">
      <Topbar />
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-64 mt-[72px] md:mt-0 p-lg md:p-xl overflow-y-auto h-full">
        {children}
      </main>
      
      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-surface-container-low border-t border-outline-variant/10 flex justify-around p-sm z-50">
        <Link className="flex flex-col items-center p-2 text-primary" href="/dashboard">
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
          <span className="font-label-caps text-[9px] mt-1">Dashboard</span>
        </Link>
        <Link className="flex flex-col items-center p-2 text-on-surface-variant" href="/dashboard/projects">
          <span className="material-symbols-outlined text-[20px]">folder_open</span>
          <span className="font-label-caps text-[9px] mt-1">Projects</span>
        </Link>
        <Link className="flex flex-col items-center p-2 text-on-surface-variant" href="/dashboard/settings">
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="font-label-caps text-[9px] mt-1">Settings</span>
        </Link>
      </nav>
    </div>
  );
}
