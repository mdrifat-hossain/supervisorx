"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface AppSidebarProps {
  activeTab?: string;
}

export default function AppSidebar({ activeTab }: AppSidebarProps) {
  const pathname = usePathname();
  const [internalTab, setInternalTab] = useState<string>("");

  const isDashboard =
    activeTab === "Dashboard" ||
    pathname === "/dashboard" ||
    pathname === "/minimal_dashboard" ||
    pathname === "/minimal-dashboard";

  const isProjects =
    activeTab === "Projects" ||
    pathname === "/projects";

  return (
    <aside className="w-[260px] flex-shrink-0 flex flex-col bg-surface-container-low border-r border-outline-variant/20 h-screen sticky top-0 z-40 select-none">
      {/* Brand Header */}
      <Link
        href="/dashboard"
        className="p-lg flex items-center gap-sm group transition-opacity hover:opacity-90"
      >
        <div className="w-8 h-8 bg-primary-container rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
          <span
            className="material-symbols-outlined text-on-primary-container text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            sync_alt
          </span>
        </div>
        <span className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
          SupervisorX
        </span>
      </Link>

      {/* Main Navigation */}
      <nav className="flex-1 mt-md space-y-xs px-sm overflow-y-auto custom-scrollbar">
        {/* Dashboard Link */}
        <Link
          href="/dashboard"
          className={`w-full flex items-center gap-md px-md py-sm rounded-lg group transition-all duration-200 text-left ${
            isDashboard
              ? "active-nav font-medium"
              : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">dashboard</span>
          <span className="font-label-md text-label-md">Dashboard</span>
        </Link>

        {/* Projects Link */}
        <Link
          href="/projects"
          className={`w-full flex items-center gap-md px-md py-sm rounded-lg group transition-all duration-200 text-left ${
            isProjects
              ? "active-nav font-medium"
              : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">folder_open</span>
          <span className="font-label-md text-label-md">Projects</span>
        </Link>

        {/* Research Graph */}
        <button
          type="button"
          onClick={() => setInternalTab("Research Graph")}
          className={`w-full flex items-center gap-md px-md py-sm rounded-lg group transition-all duration-200 text-left cursor-pointer ${
            internalTab === "Research Graph" && !isDashboard && !isProjects
              ? "active-nav font-medium"
              : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">science</span>
          <span className="font-label-md text-label-md">Research Graph</span>
        </button>

        {/* Paper Library */}
        <button
          type="button"
          onClick={() => setInternalTab("Paper Library")}
          className={`w-full flex items-center gap-md px-md py-sm rounded-lg group transition-all duration-200 text-left cursor-pointer ${
            internalTab === "Paper Library" && !isDashboard && !isProjects
              ? "active-nav font-medium"
              : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">description</span>
          <span className="font-label-md text-label-md">Paper Library</span>
        </button>

        {/* Datasets */}
        <button
          type="button"
          onClick={() => setInternalTab("Datasets")}
          className={`w-full flex items-center gap-md px-md py-sm rounded-lg group transition-all duration-200 text-left cursor-pointer ${
            internalTab === "Datasets" && !isDashboard && !isProjects
              ? "active-nav font-medium"
              : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">analytics</span>
          <span className="font-label-md text-label-md">Datasets</span>
        </button>

        {/* Active Projects Header */}
        <div className="pt-xl pb-sm px-md opacity-40">
          <span className="font-label-md text-[10px] uppercase tracking-widest">
            Active Projects
          </span>
        </div>

        {/* Cognitive Mapper v4 */}
        <Link
          href="/projects/cognitive-mapper"
          className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface transition-all group"
        >
          <div className="w-2 h-2 rounded-full bg-primary group-hover:scale-125 transition-transform"></div>
          <span className="font-label-md text-label-md truncate">Cognitive Mapper v4</span>
        </Link>

        {/* Neural Synthesis V2 */}
        <Link
          href="/projects"
          className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface transition-all group"
        >
          <div className="w-2 h-2 rounded-full bg-tertiary group-hover:scale-125 transition-transform"></div>
          <span className="font-label-md text-label-md truncate">Neural Synthesis V2</span>
        </Link>

        {/* Quantum Cognition */}
        <Link
          href="/projects"
          className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface transition-all group"
        >
          <div className="w-2 h-2 rounded-full bg-primary-container group-hover:scale-125 transition-transform"></div>
          <span className="font-label-md text-label-md truncate">Quantum Cognition</span>
        </Link>

        {/* Cognitive Bio-hacking */}
        <Link
          href="/projects"
          className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface transition-all group"
        >
          <div className="w-2 h-2 rounded-full bg-secondary group-hover:scale-125 transition-transform"></div>
          <span className="font-label-md text-label-md truncate">Cognitive Bio-hacking</span>
        </Link>
      </nav>

      {/* Profile User Footer */}
      <div className="p-md border-t border-outline-variant/20 mt-auto">
        <div className="flex items-center gap-md p-sm hover:bg-surface-variant/20 rounded-xl cursor-pointer transition-all group">
          <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden border border-outline-variant/30 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            AT
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-label-md text-on-surface truncate font-medium">Dr. Aris Thorne</div>
            <div className="font-code-sm text-[10px] text-on-surface-variant uppercase tracking-wider">
              Senior Fellow
            </div>
          </div>
          <Link
            href="/login"
            title="Account Settings & Session"
            className="text-on-surface-variant hover:text-primary transition-colors p-1"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
