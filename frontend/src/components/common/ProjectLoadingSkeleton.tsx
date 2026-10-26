"use client";

import ProjectSidebar from "./ProjectSidebar";
import { usePathname } from "next/navigation";

export default function ProjectLoadingSkeleton({
  projectId,
  projectName,
}: {
  projectId?: string;
  projectName?: string;
}) {
  const pathname = usePathname();
  const pathProjectId = pathname?.startsWith("/projects/") ? pathname.split("/")[2] : undefined;
  const effectiveProjectId = projectId || pathProjectId;

  const isChatbot = pathname?.includes("/chatbot");
  const isLibrary = pathname?.includes("/library");
  const isAnalysis = pathname?.includes("/analysis");

  const moduleName = isChatbot
    ? "Find Papers AI Chatbot"
    : isLibrary
    ? "All Documents"
    : isAnalysis
    ? "Upload & Analysis"
    : "Project Dashboard";

  return (
    <div className="bg-background text-on-surface font-body-md text-body-md antialiased min-h-screen flex selection:bg-primary-container selection:text-on-primary-container">
      {/* 1. Left Project Sidebar - Persists immediately during navigation */}
      <ProjectSidebar
        projectId={effectiveProjectId}
        projectName={projectName}
      />

      {/* 2. Main Canvas Shimmer Skeleton */}
      <div className="ml-sidebar-width flex-1 flex flex-col min-w-0 bg-background min-h-screen">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 bg-surface-container-lowest/85 backdrop-blur-md px-6 py-3 flex items-center justify-between border-b border-outline-variant/20">
          <div className="flex items-center gap-3 text-xs font-label-md text-on-surface-variant">
            <span className="text-outline">Projects</span>
            <span className="text-outline">/</span>
            <span className="text-on-surface font-semibold">{moduleName}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high/60 animate-pulse" />
            <div className="w-20 h-8 rounded-lg bg-surface-container-high/60 animate-pulse" />
          </div>
        </header>

        {/* Content Shimmer Area */}
        <main className="p-6 md:p-8 flex-1 flex flex-col gap-6 max-w-[1600px] w-full min-w-0 mx-auto">
          {/* Title Area */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-8 w-64 bg-surface-container-high/80 rounded-lg animate-pulse" />
              <div className="h-4 w-96 max-w-full bg-surface-container/60 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-28 bg-surface-container-high/80 rounded-lg animate-pulse" />
              <div className="h-9 w-32 bg-primary/20 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Metric / Tool Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-surface-container-low/60 border border-outline-variant/20 p-4 flex flex-col justify-between animate-pulse"
              >
                <div className="h-3 w-20 bg-surface-container-high rounded" />
                <div className="h-6 w-16 bg-surface-container-high rounded" />
              </div>
            ))}
          </div>

          {/* Central Workspace Shimmer with Spinner */}
          <div className="flex-1 min-h-[360px] rounded-2xl bg-surface-container-low/40 border border-outline-variant/20 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4" />
            <h3 className="text-sm font-semibold text-on-surface mb-1">
              Loading {moduleName}...
            </h3>
            <p className="text-xs text-on-surface-variant max-w-sm">
              Preparing project neural context and literature index.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
