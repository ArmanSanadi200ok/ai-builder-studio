"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/Button";

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/dashboard/projects", icon: "folder_open", label: "Projects" },
  { href: "/dashboard/settings", icon: "settings", label: "Settings" },
  { href: "/dashboard/providers", icon: "hub", label: "Providers" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col p-md bg-surface-container border-r border-outline-variant/20">
      <div className="mb-xl">
        <div className="flex items-center gap-md">
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[20px]">architecture</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">AI Builder</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">v1.0.4-alpha</p>
          </div>
        </div>
      </div>
      <Button className="mb-lg w-full">New App</Button>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-md px-md py-sm rounded-lg transition-all ${
                isActive
                  ? "bg-secondary-container text-on-secondary-container hover:opacity-80"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className="font-label-caps text-label-caps">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-md border-t border-outline-variant/20">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-on-surface-variant">Profile</span>
          <div className="w-8 h-8 rounded-full border border-outline-variant/50 bg-surface-container-high flex items-center justify-center text-on-surface">
             <span className="material-symbols-outlined text-[16px]">person</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
