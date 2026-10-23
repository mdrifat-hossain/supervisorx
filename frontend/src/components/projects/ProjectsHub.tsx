"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import AppSidebar from "@/components/common/AppSidebar";

export interface ProjectItem {
  id: string;
  title: string;
  domain: string;
  description: string;
  color: string;
  papers_count: number;
  dataset_size: string;
  collaborators: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ColorOption {
  id: string;
  label: string;
  hex: string;
  tagBg: string;
  tagText: string;
  tagBorder: string;
  hoverBorder: string;
  hoverText: string;
  openBtnBg: string;
  openBtnText: string;
  badgeRing: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  {
    id: "primary",
    label: "Theme Blue (Default)",
    hex: "#adc6ff",
    tagBg: "bg-primary/10",
    tagText: "text-primary",
    tagBorder: "border-primary/20",
    hoverBorder: "hover:border-primary/40",
    hoverText: "group-hover:text-primary",
    openBtnBg: "bg-primary",
    openBtnText: "text-on-primary",
    badgeRing: "ring-primary",
  },
  {
    id: "tertiary",
    label: "Neon Lavender",
    hex: "#d0bcff",
    tagBg: "bg-tertiary/10",
    tagText: "text-tertiary",
    tagBorder: "border-tertiary/20",
    hoverBorder: "hover:border-tertiary/40",
    hoverText: "group-hover:text-tertiary",
    openBtnBg: "bg-tertiary",
    openBtnText: "text-on-tertiary",
    badgeRing: "ring-tertiary",
  },
  {
    id: "emerald",
    label: "Emerald Mint",
    hex: "#34d399",
    tagBg: "bg-emerald-500/10",
    tagText: "text-emerald-400",
    tagBorder: "border-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/40",
    hoverText: "group-hover:text-emerald-400",
    openBtnBg: "bg-emerald-500",
    openBtnText: "text-slate-950",
    badgeRing: "ring-emerald-400",
  },
  {
    id: "amber",
    label: "Solar Amber",
    hex: "#fbbf24",
    tagBg: "bg-amber-500/10",
    tagText: "text-amber-400",
    tagBorder: "border-amber-500/20",
    hoverBorder: "hover:border-amber-500/40",
    hoverText: "group-hover:text-amber-400",
    openBtnBg: "bg-amber-500",
    openBtnText: "text-slate-950",
    badgeRing: "ring-amber-400",
  },
  {
    id: "rose",
    label: "Coral Rose",
    hex: "#fb7185",
    tagBg: "bg-rose-500/10",
    tagText: "text-rose-400",
    tagBorder: "border-rose-500/20",
    hoverBorder: "hover:border-rose-500/40",
    hoverText: "group-hover:text-rose-400",
    openBtnBg: "bg-rose-500",
    openBtnText: "text-slate-950",
    badgeRing: "ring-rose-400",
  },
  {
    id: "cyan",
    label: "Quantum Cyan",
    hex: "#22d3ee",
    tagBg: "bg-cyan-500/10",
    tagText: "text-cyan-400",
    tagBorder: "border-cyan-500/20",
    hoverBorder: "hover:border-cyan-500/40",
    hoverText: "group-hover:text-cyan-400",
    openBtnBg: "bg-cyan-500",
    openBtnText: "text-slate-950",
    badgeRing: "ring-cyan-400",
  },
];

export function getColorConfig(colorId?: string): ColorOption {
  const found = COLOR_OPTIONS.find((c) => c.id === colorId);
  return found || COLOR_OPTIONS[0];
}

export default function ProjectsHub() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Projects state
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showAiAssistant, setShowAiAssistant] = useState(true);

  // Create Project Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDomain, setNewDomain] = useState("NEURAL NETWORKS");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("primary");

  // Settings (Edit Project) Modal state
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState("primary");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch real projects from PostgreSQL API
  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.success && Array.isArray(data.projects)) {
        setProjects(data.projects);
      } else {
        setFetchError(data.error || "Failed to load projects from database");
      }
    } catch (err: unknown) {
      console.error("Error fetching projects:", err);
      setFetchError("Unable to connect to projects service");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter projects by search
  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.domain.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  // Handle Project Creation
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsCreating(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          domain: newDomain.trim(),
          description: newDesc.trim(),
          color: newColor,
        }),
      });

      const data = await res.json();
      if (data.success && data.project) {
        setProjects((prev) => [data.project, ...prev]);
        setNewTitle("");
        setNewDomain("NEURAL NETWORKS");
        setNewDesc("");
        setNewColor("primary");
        setIsCreateModalOpen(false);
      } else {
        alert(data.error || "Failed to create project");
      }
    } catch (err) {
      console.error("Failed to create project:", err);
      alert("Error saving project. Please check your database connection.");
    } finally {
      setIsCreating(false);
    }
  };

  // Open Settings Modal for a specific project
  const handleOpenSettings = (project: ProjectItem) => {
    setEditingProject(project);
    setEditTitle(project.title);
    setEditDomain(project.domain);
    setEditDesc(project.description || "");
    setEditColor(project.color || "primary");
    setShowDeleteConfirm(false);
  };

  // Handle Project Update
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editTitle.trim()) return;

    try {
      setIsUpdating(true);
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          domain: editDomain.trim(),
          description: editDesc.trim(),
          color: editColor,
        }),
      });

      const data = await res.json();
      if (data.success && data.project) {
        setProjects((prev) =>
          prev.map((p) => (p.id === data.project.id ? data.project : p))
        );
        setEditingProject(null);
      } else {
        alert(data.error || "Failed to update project");
      }
    } catch (err) {
      console.error("Failed to update project:", err);
      alert("Error saving project changes.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Project Deletion
  const handleDeleteProject = async () => {
    if (!editingProject) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setProjects((prev) => prev.filter((p) => p.id !== editingProject.id));
        setEditingProject(null);
      } else {
        alert(data.error || "Failed to delete project");
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Error deleting project.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-background font-body-md selection:bg-primary/30 antialiased">
      {/* Left Sidebar (Common AppSidebar) */}
      <AppSidebar activeTab="Projects" />

      {/* Main Content Canvas */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-background">
        {/* Decorative Ambient Light */}
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] bg-tertiary/5 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-xl border-b border-outline-variant/20 bg-background/50 backdrop-blur-md z-40">
          <div className="flex items-center gap-lg">
            <h2 className="font-headline-md text-headline-md text-on-surface">Projects</h2>
            <div className="relative w-72 lg:w-96 group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors text-[20px]">
                search
              </span>
              <input
                ref={searchInputRef}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-2 pl-10 pr-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-body-md text-body-md placeholder:text-outline-variant"
                placeholder="Search projects, domains, hypotheses... (/ to focus)"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-md">
            <button
              onClick={fetchProjects}
              className="flex items-center gap-sm px-md py-2 text-on-surface-variant hover:bg-surface-variant/30 rounded-lg transition-all active:scale-95 cursor-pointer"
              title="Refresh projects list"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
              <span className="font-label-md text-label-md hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-sm bg-primary text-on-primary font-bold px-lg py-2.5 rounded-lg shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                add
              </span>
              <span className="font-label-md text-label-md">Create Project</span>
            </button>
          </div>
        </header>

        {/* Project Grid Scrollable Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
          {/* Loading Skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg max-w-container-max mx-auto">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-surface-container-low/60 border border-outline-variant/20 rounded-xl p-6 flex flex-col gap-4 animate-pulse min-h-[300px]"
                >
                  <div className="flex justify-between items-center">
                    <div className="h-6 w-32 bg-surface-container-highest rounded-full"></div>
                    <div className="h-7 w-7 rounded-full bg-surface-container-highest"></div>
                  </div>
                  <div className="h-7 w-48 bg-surface-container-highest rounded-md mt-2"></div>
                  <div className="space-y-2 mt-2">
                    <div className="h-4 w-full bg-surface-container-highest/60 rounded"></div>
                    <div className="h-4 w-3/4 bg-surface-container-highest/60 rounded"></div>
                  </div>
                  <div className="mt-auto pt-4 border-t border-outline-variant/10 flex gap-2">
                    <div className="h-9 flex-1 bg-surface-container-highest rounded-lg"></div>
                    <div className="h-9 w-9 bg-surface-container-highest rounded-lg"></div>
                    <div className="h-9 w-9 bg-surface-container-highest rounded-lg"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Database Fetch Error */}
          {!isLoading && fetchError && (
            <div className="max-w-[620px] mx-auto p-6 rounded-2xl bg-surface-container-low border border-error/30 text-center space-y-4 my-12">
              <span className="material-symbols-outlined text-4xl text-error">cloud_off</span>
              <h3 className="text-lg font-bold text-on-surface">PostgreSQL Sync Notice</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{fetchError}</p>
              <button
                onClick={fetchProjects}
                className="px-5 py-2 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:brightness-110 transition-all cursor-pointer"
              >
                Retry Database Connection
              </button>
            </div>
          )}

          {/* Projects Grid */}
          {!isLoading && !fetchError && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg max-w-container-max mx-auto">
              {/* Dynamic Project Cards from PostgreSQL */}
              {filteredProjects.map((project) => {
                const colorConfig = getColorConfig(project.color);
                const collabs = Array.isArray(project.collaborators)
                  ? project.collaborators
                  : ["ME"];

                return (
                  <div
                    key={project.id}
                    className={`group relative flex flex-col bg-surface-container-low border border-outline-variant/20 rounded-xl p-md ${colorConfig.hoverBorder} hover:shadow-2xl hover:shadow-black/40 transition-all duration-300`}
                  >
                    {/* Card Top: Tag & Collaborators */}
                    <div className="flex items-start justify-between mb-md">
                      <div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${colorConfig.tagBg} ${colorConfig.tagText} border ${colorConfig.tagBorder} mb-sm`}
                        >
                          {project.domain}
                        </span>
                        <Link
                          href={`/projects/${project.id}`}
                          className={`font-headline-md text-body-lg font-semibold text-on-surface ${colorConfig.hoverText} transition-colors block leading-snug`}
                        >
                          {project.title}
                        </Link>
                      </div>
                      <div className="flex -space-x-2">
                        {collabs.map((collab, idx) => (
                          <div
                            key={idx}
                            className="w-7 h-7 rounded-full border-2 border-surface-container-low bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface"
                          >
                            {collab}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-on-surface-variant font-body-md text-body-md mb-lg line-clamp-2 leading-relaxed">
                      {project.description || "Dedicated research workspace with AI graph synthesis."}
                    </p>

                    {/* Meta Info */}
                    <div className="flex items-center gap-xl mb-lg">
                      <div className="flex items-center gap-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px]">description</span>
                        <span className="font-label-md text-label-md">
                          {project.papers_count || 0} Papers
                        </span>
                      </div>
                      <div className="flex items-center gap-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px]">dataset</span>
                        <span className="font-label-md text-label-md">
                          {project.dataset_size || "0 GB"}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="mt-auto pt-md border-t border-outline-variant/10">
                      <div className="flex items-center gap-sm">
                        {/* Open Button: Navigates to project workspace dashboard */}
                        <Link
                          href={`/projects/${project.id}`}
                          className={`flex-1 py-2 ${colorConfig.openBtnBg} ${colorConfig.openBtnText} font-bold rounded-lg text-label-md hover:brightness-110 active:scale-95 transition-all cursor-pointer text-center block shadow-sm`}
                        >
                          Open
                        </Link>

                        {/* Download Button (Disabled for now as requested) */}
                        <button
                          disabled
                          className="p-2 rounded-lg text-outline-variant/50 cursor-not-allowed opacity-40 select-none transition-colors"
                          title="Download archive (temporarily disabled)"
                        >
                          <span className="material-symbols-outlined text-[20px]">download</span>
                        </button>

                        {/* Settings Button: Opens Project Settings Modal */}
                        <button
                          onClick={() => handleOpenSettings(project)}
                          className="p-2 hover:bg-surface-variant/40 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                          title="Project Settings (Edit Title, Domain, Color & Objective)"
                        >
                          <span className="material-symbols-outlined text-[20px]">settings</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Create New Project Card Placeholder */}
              <div
                onClick={() => setIsCreateModalOpen(true)}
                className="group flex flex-col items-center justify-center bg-surface-container-lowest border-2 border-dashed border-outline-variant/30 rounded-xl p-md hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer min-h-[300px]"
              >
                <div className="w-16 h-16 rounded-full bg-surface-variant/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-[32px]">add_circle</span>
                </div>
                <span className="mt-md font-headline-md text-body-lg font-semibold text-on-surface-variant group-hover:text-on-surface transition-colors">
                  Start New Research
                </span>
                <p className="mt-sm text-center text-outline text-[13px] px-lg">
                  Initialize a new canvas for your next breakthrough project.
                </p>
              </div>
            </div>
          )}

          {/* Empty State when zero projects in database */}
          {!isLoading && !fetchError && projects.length === 0 && (
            <div className="max-w-[560px] mx-auto mt-8 text-center p-8 rounded-2xl bg-surface-container-low/40 border border-outline-variant/20 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                <span className="material-symbols-outlined text-3xl">lightbulb</span>
              </div>
              <h3 className="text-xl font-bold text-on-surface font-headline-md">
                No Research Projects Created Yet
              </h3>
              <p className="text-sm text-on-surface-variant leading-relaxed font-body-md">
                Your PostgreSQL database is connected and ready. Click below to create your first
                high-dimensional research project workspace.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-lg shadow-primary/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Create Your First Project
              </button>
            </div>
          )}
        </div>

        {/* AI Assistant Floating Panel */}
        {showAiAssistant && (
          <div className="absolute bottom-6 right-6 z-50">
            <div className="glass-panel rounded-2xl p-md shadow-2xl border-primary/20 w-[320px] transform transition-all duration-500 hover:translate-y-[-4px]">
              <div className="flex items-center justify-between mb-md">
                <div className="flex items-center gap-sm">
                  <div className="relative w-2 h-2">
                    <div className="absolute inset-0 bg-primary rounded-full animate-ping"></div>
                    <div className="relative w-2 h-2 bg-primary rounded-full"></div>
                  </div>
                  <span className="font-label-md text-label-md text-primary font-bold">
                    Supervisor Assistant
                  </span>
                </div>
                <button
                  onClick={() => setShowAiAssistant(false)}
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  aria-label="Close assistant panel"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <p className="text-[13px] leading-relaxed text-on-surface mb-md">
                &quot;PostgreSQL database sync is active. You can create customized research workspaces
                with dedicated accent palettes and knowledge graphs.&quot;
              </p>
              <div className="flex gap-sm">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex-1 py-1.5 bg-primary text-on-primary font-bold rounded-lg text-[12px] hover:brightness-110 cursor-pointer"
                >
                  New Project
                </button>
                <button
                  onClick={() => setShowAiAssistant(false)}
                  className="px-3 py-1.5 bg-surface-variant/40 text-on-surface rounded-lg text-[12px] hover:bg-surface-variant/60 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 1: CREATE PROJECT MODAL                             */}
        {/* ========================================================= */}
        {isCreateModalOpen && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCreateModalOpen(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
          >
            <div className="relative w-full max-w-[620px] rounded-2xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-6 sm:p-8 flex flex-col gap-6 my-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-outline-variant/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-inner">
                    <span className="material-symbols-outlined text-2xl">folder_special</span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
                      Create New Research Project
                    </h3>
                    <p className="font-body-md text-xs sm:text-sm text-on-surface-variant mt-0.5">
                      Initialize a dedicated AI workspace with knowledge graphs, datasets &amp; paper synthesis.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer shrink-0"
                  aria-label="Close dialog"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleCreateProject} className="flex flex-col gap-5">
                {/* Field 1: Project Title */}
                <div>
                  <label className="block font-label-md text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-1.5">
                    Project Title <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cognitive Mapper v5 or Quantum NLP Reasoning"
                    className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-2.5 px-4 text-sm font-body-md text-on-surface placeholder:text-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {/* Field 2: Domain / Tag Selection */}
                <div>
                  <label className="block font-label-md text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-1.5">
                    Research Domain / Category <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NEURAL NETWORKS, BIO-INFORMATICS"
                    className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-2.5 px-4 text-sm font-body-md text-on-surface placeholder:text-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all mb-2"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    required
                  />
                  {/* Quick Domain Suggestions */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-label-md text-outline mr-1">Suggestions:</span>
                    {[
                      "NEURAL NETWORKS",
                      "BIO-INFORMATICS",
                      "QUANTUM NLP",
                      "AI ETHICS",
                      "ROBOTICS & VISION",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setNewDomain(suggestion)}
                        className={`px-2 py-0.5 rounded text-[10px] font-label-md border transition-all cursor-pointer ${
                          newDomain.toUpperCase() === suggestion
                            ? "bg-primary text-on-primary border-primary font-semibold"
                            : "bg-surface-container-high/60 text-on-surface-variant border-outline-variant/30 hover:border-primary/40 hover:text-on-surface"
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 3: Accent Color Choice (User Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-label-md text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                      Project Accent Color <span className="text-outline text-[11px] font-normal">(Optional)</span>
                    </label>
                    <span className="text-xs font-label-md text-on-surface-variant">
                      Selected: <strong>{getColorConfig(newColor).label}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNewColor(opt.id)}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer text-left ${
                          newColor === opt.id
                            ? `bg-surface-container-high border-primary ${opt.badgeRing} ring-2 ring-offset-1 ring-offset-surface`
                            : "bg-surface-container-lowest border-outline-variant/30 hover:border-outline-variant hover:bg-surface-container-high/40"
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: opt.hex }}
                        ></span>
                        <span className="text-xs font-label-md text-on-surface truncate">
                          {opt.label.split(" ")[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 4: Research Objective */}
                <div>
                  <label className="block font-label-md text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-1.5">
                    Research Objective &amp; Hypothesis <span className="text-outline text-[11px] font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the problem, target benchmark, or core hypothesis to ground SupervisorX..."
                    className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-2.5 px-4 text-sm font-body-md text-on-surface placeholder:text-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none resize-none transition-all"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>

                {/* AI Workspace Info Pill */}
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/25 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-primary text-base">hub</span>
                    <span>Database: <strong>PostgreSQL Verified</strong></span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-label-md font-semibold">
                    AUTO VECTOR INDEX
                  </span>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/40 text-on-surface font-label-md text-xs sm:text-sm font-medium hover:bg-surface-variant transition-all cursor-pointer active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-xs sm:text-sm font-bold shadow-lg shadow-primary/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isCreating ? "sync" : "add_circle"}
                    </span>
                    <span>{isCreating ? "Initializing..." : "Initialize Workspace"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 2: PROJECT SETTINGS (EDIT & MANAGE) MODAL          */}
        {/* ========================================================= */}
        {editingProject && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingProject(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
          >
            <div className="relative w-full max-w-[620px] rounded-2xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-6 sm:p-8 flex flex-col gap-6 my-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-outline-variant/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-container/40 border border-secondary/30 flex items-center justify-center text-secondary-fixed shrink-0 shadow-inner">
                    <span className="material-symbols-outlined text-2xl">settings</span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
                      Project Settings
                    </h3>
                    <p className="font-body-md text-xs sm:text-sm text-on-surface-variant mt-0.5">
                      Modify title, research domain, accent palette, or manage workspace.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingProject(null)}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer shrink-0"
                  aria-label="Close dialog"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleUpdateProject} className="flex flex-col gap-5">
                {/* Field 1: Project Title */}
                <div>
                  <label className="block font-label-md text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-1.5">
                    Project Title <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-2.5 px-4 text-sm font-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Field 2: Domain / Tag */}
                <div>
                  <label className="block font-label-md text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-1.5">
                    Research Domain / Category <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-2.5 px-4 text-sm font-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all mb-2"
                    value={editDomain}
                    onChange={(e) => setEditDomain(e.target.value)}
                    required
                  />
                  {/* Quick Domain Suggestions */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-label-md text-outline mr-1">Suggestions:</span>
                    {[
                      "NEURAL NETWORKS",
                      "BIO-INFORMATICS",
                      "QUANTUM NLP",
                      "AI ETHICS",
                      "ROBOTICS & VISION",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setEditDomain(suggestion)}
                        className={`px-2 py-0.5 rounded text-[10px] font-label-md border transition-all cursor-pointer ${
                          editDomain.toUpperCase() === suggestion
                            ? "bg-primary text-on-primary border-primary font-semibold"
                            : "bg-surface-container-high/60 text-on-surface-variant border-outline-variant/30 hover:border-primary/40 hover:text-on-surface"
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 3: Accent Color Choice */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-label-md text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                      Project Accent Color
                    </label>
                    <span className="text-xs font-label-md text-on-surface-variant">
                      Selected: <strong>{getColorConfig(editColor).label}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditColor(opt.id)}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer text-left ${
                          editColor === opt.id
                            ? `bg-surface-container-high border-primary ${opt.badgeRing} ring-2 ring-offset-1 ring-offset-surface`
                            : "bg-surface-container-lowest border-outline-variant/30 hover:border-outline-variant hover:bg-surface-container-high/40"
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: opt.hex }}
                        ></span>
                        <span className="text-xs font-label-md text-on-surface truncate">
                          {opt.label.split(" ")[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 4: Research Objective */}
                <div>
                  <label className="block font-label-md text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-1.5">
                    Research Objective &amp; Hypothesis
                  </label>
                  <textarea
                    rows={3}
                    className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-2.5 px-4 text-sm font-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none resize-none transition-all"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                </div>

                {/* Danger Zone: Delete Option */}
                <div className="pt-2 border-t border-outline-variant/20">
                  {!showDeleteConfirm ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-outline font-label-md">
                        Permanent Actions
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-error hover:text-error-container text-xs font-label-md flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        <span>Delete Project</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-error/10 border border-error/30 flex items-center justify-between gap-3">
                      <span className="text-xs text-error font-medium">
                        Confirm delete this project and all its artifacts?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-2.5 py-1 text-xs text-on-surface hover:bg-surface-variant rounded font-label-md cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteProject}
                          disabled={isDeleting}
                          className="px-3 py-1 bg-error text-on-error text-xs rounded font-label-md font-bold hover:brightness-110 cursor-pointer disabled:opacity-50"
                        >
                          {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setEditingProject(null)}
                    className="px-5 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/40 text-on-surface font-label-md text-xs sm:text-sm font-medium hover:bg-surface-variant transition-all cursor-pointer active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-xs sm:text-sm font-bold shadow-lg shadow-primary/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isUpdating ? "sync" : "save"}
                    </span>
                    <span>{isUpdating ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
