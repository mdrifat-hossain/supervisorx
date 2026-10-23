"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

interface ProjectSidebarProps {
  projectId?: string;
  projectName?: string;
  activeTab?: "dashboard" | "chatbot" | "analysis" | "library" | "settings";
}

function PathTracker({
  onPathChange,
}: {
  onPathChange: (path: string) => void;
}) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) {
      onPathChange(pathname);
    }
  }, [pathname, onPathChange]);
  return null;
}

export default function ProjectSidebar({
  projectId = "cognitive-mapper",
  projectName,
  activeTab,
}: ProjectSidebarProps) {
  const [detectedTab, setDetectedTab] = useState<
    "dashboard" | "chatbot" | "analysis" | "library" | "settings"
  >(activeTab || "dashboard");

  const currentTab = activeTab || detectedTab;
  const effectiveProjectId = projectId || "cognitive-mapper";
  const [currentProjectTitle, setCurrentProjectTitle] = useState(
    projectName || (effectiveProjectId === "cognitive-mapper" ? "Cognitive Mapper v4" : "Project Workspace")
  );

  const [papersCount, setPapersCount] = useState<number | null>(null);

  useEffect(() => {
    if (projectName) {
      setCurrentProjectTitle(projectName);
    }
    if (effectiveProjectId) {
      fetch(`/api/projects/${effectiveProjectId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.project?.title && !projectName) {
            setCurrentProjectTitle(data.project.title);
          }
          if (typeof data?.project?.papers_count === "number") {
            setPapersCount(data.project.papers_count);
          }
        })
        .catch(() => {});
    }
  }, [effectiveProjectId, projectName]);

  return (
    <aside className="fixed top-0 left-0 h-screen w-sidebar-width flex flex-col justify-between p-4 bg-surface-container-low border-r border-outline-variant/30 z-50 select-none overflow-y-auto custom-scrollbar">
      {/* Suspense-wrapped tracker for client-side pathname detection only when activeTab is not provided */}
      {!activeTab && (
        <Suspense fallback={null}>
          <PathTracker
            onPathChange={(p) => {
              if (p.includes("/chatbot")) setDetectedTab("chatbot");
              else if (p.includes("/analysis")) setDetectedTab("analysis");
              else if (p.includes("/library")) setDetectedTab("library");
              else setDetectedTab("dashboard");
            }}
          />
        </Suspense>
      )}

      {/* Top Branding, Back Button & Switcher */}
      <div className="flex flex-col gap-3">
        {/* Back Button to Projects Hub */}
        <Link
          href="/projects"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-high/60 hover:bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/30 text-xs font-label-md transition-all active:scale-[0.98] group"
          title="Return to Projects Hub"
        >
          <span className="material-symbols-outlined text-[18px] text-primary group-hover:-translate-x-1 transition-transform">
            arrow_back
          </span>
          <span className="font-medium">Back to Projects</span>
        </Link>

        {/* SupervisorX Header */}
        <div className="flex items-center justify-between px-2 pt-1">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-surface-container-highest border border-outline-variant/40 flex items-center justify-center text-primary shadow-inner group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-xl">hub</span>
            </div>
            <div>
              <div className="font-headline-md text-body-md font-bold text-on-surface tracking-tight leading-none">
                SupervisorX
              </div>
              <div className="font-code-sm text-code-sm text-outline tracking-wider uppercase text-[10px]">
                Research Engine
              </div>
            </div>
          </Link>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-label-md bg-surface-container-high text-primary border border-primary/20">
            v4.2
          </span>
        </div>

        {/* Active Project Switcher Pill */}
        <Link
          href="/projects"
          className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 hover:border-primary/40 transition-colors cursor-pointer group block"
          title="Click to switch project"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-label-md text-on-surface-variant flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              ACTIVE PROJECT
            </span>
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-sm">
              unfold_more
            </span>
          </div>
          <div className="font-headline-md text-body-md font-semibold text-on-surface flex items-center gap-1.5 truncate">
            {currentProjectTitle}
          </div>
          {/* <div className="flex items-center gap-1 mt-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-label-md bg-surface-variant/70 text-primary-fixed-dim border border-outline-variant/30">
              Neural Networks
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-label-md bg-surface-variant/40 text-outline border border-outline-variant/20">
              Latent Entropies
            </span>
          </div> */}
        </Link>

        {/* Main Action CTA */}
        <Link
          href={`/projects/${effectiveProjectId}/analysis`}
          className="w-full py-2.5 px-3 rounded-lg bg-primary-container text-on-primary-container font-headline-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-primary transition-all duration-150 active:scale-[0.98] shadow-md shadow-primary/10 cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          <span>New Analysis</span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1 mt-1">
          {/* Item 1: Project Dashboard */}
          <Link
            href={`/projects/${effectiveProjectId}`}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
              currentTab === "dashboard"
                ? "bg-surface-container text-primary font-medium border-l-2 border-primary shadow-sm"
                : "text-on-surface-variant font-normal hover:bg-surface-container-high hover:text-on-surface active:scale-[0.98]"
            }`}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{
                fontVariationSettings: currentTab === "dashboard" ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              dashboard
            </span>
            <span className="font-body-md text-body-md">Project Dashboard</span>
          </Link>

          {/* Item 2: Find Papers AI Chatbot */}
          <Link
            href={`/projects/${effectiveProjectId}/chatbot`}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
              currentTab === "chatbot"
                ? "bg-surface-container text-primary font-medium border-l-2 border-primary shadow-sm"
                : "text-on-surface-variant font-normal hover:bg-surface-container-high hover:text-on-surface active:scale-[0.98]"
            }`}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{
                fontVariationSettings: currentTab === "chatbot" ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              smart_toy
            </span>
            <span className="font-body-md text-body-md">Find Papers AI Chatbot</span>
          </Link>

          {/* Item 3: Upload & Analysis */}
          <Link
            href={`/projects/${effectiveProjectId}/analysis`}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
              currentTab === "analysis"
                ? "bg-surface-container text-primary font-medium border-l-2 border-primary shadow-sm"
                : "text-on-surface-variant font-normal hover:bg-surface-container-high hover:text-on-surface active:scale-[0.98]"
            }`}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{
                fontVariationSettings: currentTab === "analysis" ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              cloud_upload
            </span>
            <span className="font-body-md text-body-md">Upload &amp; Analysis</span>
          </Link>

          {/* Item 4: Paper Library */}
          <Link
            href={`/projects/${effectiveProjectId}/library`}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
              currentTab === "library"
                ? "bg-surface-container text-primary font-medium border-l-2 border-primary shadow-sm"
                : "text-on-surface-variant font-normal hover:bg-surface-container-high hover:text-on-surface active:scale-[0.98]"
            }`}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{
                fontVariationSettings: currentTab === "library" ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              library_books
            </span>
            <span className="font-body-md text-body-md">Paper Library</span>
            {papersCount !== null && (
              <span className="ml-auto font-label-md text-code-sm bg-surface-container-high px-1.5 py-0.2 rounded text-primary font-semibold">
                {papersCount}
              </span>
            )}
          </Link>

          {/* Item 5: Teammates & Settings */}
          <a
            href="#teammates"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant font-normal hover:bg-surface-container-high hover:text-on-surface transition-colors duration-150 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-xl">group_work</span>
            <span className="font-body-md text-body-md">Teammates &amp; Settings</span>
          </a>
        </nav>
      </div>

      {/* Bottom User Profile Footer */}
      <div className="pt-4 border-t border-outline-variant/20 flex flex-col gap-2 mt-4">
        <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest/80 border border-outline-variant/20">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-surface-variant border border-primary/30 flex items-center justify-center font-label-md font-semibold text-primary shrink-0">
              DR
            </div>
            <div className="truncate">
              <div className="font-headline-md text-body-md font-medium text-on-surface leading-tight truncate">
                Dr. Researcher
              </div>
              <div className="font-label-md text-code-sm text-outline flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Premium Plan
              </div>
            </div>
          </div>
          <Link
            href="/login"
            className="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors"
            title="Settings & Session"
          >
            <span className="material-symbols-outlined text-lg">tune</span>
          </Link>
        </div>
        <div className="flex justify-between text-xs font-code-sm text-outline px-1">
          <span>Vault: 4.2TB / 10TB</span>
          <span className="text-primary hover:underline cursor-pointer">Upgrade</span>
        </div>
      </div>
    </aside>
  );
}
