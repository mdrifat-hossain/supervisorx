"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import SidebarUserFooter from "@/components/common/SidebarUserFooter";

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
        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform shrink-0">
          <img
            src="/synergy.png"
            alt="SupervisorX Logo"
            className="w-full h-full object-contain"
          />
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
      <div className="px-3 pb-3 mt-auto">
        <SidebarUserFooter />
      </div>
    </aside>
  );
}
