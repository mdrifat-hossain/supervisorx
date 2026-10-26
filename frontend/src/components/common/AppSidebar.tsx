"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import SidebarUserFooter from "@/components/common/SidebarUserFooter";

interface RecentProjectSidebarItem {
  id: string;
  title: string;
  color: string;
  last_access_label: string;
}

function getProjectColorDot(color?: string) {
  switch (color) {
    case "tertiary":
      return "bg-tertiary";
    case "secondary":
      return "bg-secondary";
    case "emerald":
      return "bg-emerald-400";
    case "amber":
      return "bg-amber-400";
    case "rose":
      return "bg-rose-400";
    case "cyan":
      return "bg-cyan-400";
    case "primary":
    default:
      return "bg-primary";
  }
}

interface AppSidebarProps {
  activeTab?: string;
}

export default function AppSidebar({ activeTab }: AppSidebarProps) {
  const pathname = usePathname();
  const [internalTab, setInternalTab] = useState<string>("");
  const [recentProjects, setRecentProjects] = useState<RecentProjectSidebarItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState<boolean>(true);

  const fetchRecentProjects = useCallback(async () => {
    try {
      setLoadingRecent(true);
      const res = await fetch("/api/projects/recent");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.projects)) {
          setRecentProjects(data.projects);
        }
      }
    } catch (err) {
      console.error("Failed to load recent projects in sidebar:", err);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentProjects();
  }, [fetchRecentProjects, pathname]);

  const isDashboard =
    activeTab === "Dashboard" ||
    pathname === "/dashboard" ||
    pathname === "/minimal_dashboard" ||
    pathname === "/minimal-dashboard";

  const isProjects =
    activeTab === "Projects" ||
    pathname === "/projects";

  const isDocuments =
    activeTab === "All Documents" ||
    activeTab === "Documents" ||
    pathname === "/documents";

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

        {/* All Documents */}
        <Link
          href="/documents"
          className={`w-full flex items-center gap-md px-md py-sm rounded-lg group transition-all duration-200 text-left cursor-pointer ${
            isDocuments
              ? "active-nav font-medium"
              : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">description</span>
          <span className="font-label-md text-label-md">All Documents</span>
        </Link>

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

        {/* Open Recent Header */}
        <div className="pt-xl pb-sm px-md opacity-50 flex items-center justify-between">
          <span className="font-label-md text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
            Open Recent
          </span>
          <span className="material-symbols-outlined text-[13px] text-outline">schedule</span>
        </div>

        {/* Recent Projects List (Always up to 4 last opened projects) */}
        {loadingRecent ? (
          <div className="space-y-2 px-md py-1">
            <div className="h-4 bg-surface-container-highest/40 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-surface-container-highest/40 rounded animate-pulse w-2/3"></div>
            <div className="h-4 bg-surface-container-highest/40 rounded animate-pulse w-5/6"></div>
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="px-md py-2 text-[12px] font-code-sm text-outline">
            No recent projects
          </div>
        ) : (
          recentProjects.map((project) => {
            const isCurrent = pathname?.startsWith(`/projects/${project.id}`);
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className={`flex items-center gap-md px-md py-sm rounded-lg transition-all group ${
                  isCurrent
                    ? "bg-surface-variant/40 text-primary font-medium"
                    : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface"
                }`}
                title={`${project.title} (${project.last_access_label})`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${getProjectColorDot(
                    project.color
                  )} group-hover:scale-125 transition-transform shrink-0`}
                ></div>
                <span className="font-label-md text-label-md truncate">{project.title}</span>
              </Link>
            );
          })
        )}
      </nav>

      {/* Profile User Footer */}
      <div className="px-3 pb-3 mt-auto">
        <SidebarUserFooter />
      </div>
    </aside>
  );
}
