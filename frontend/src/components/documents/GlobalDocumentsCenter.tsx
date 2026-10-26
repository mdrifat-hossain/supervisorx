"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import AppSidebar from "@/components/common/AppSidebar";

export interface PaperProjectInfo {
  project_id: string;
  project_title: string;
  project_color?: string;
}

export interface GlobalPaper {
  id: string;
  project_id: string;
  project_title: string;
  project_color?: string;
  projects?: PaperProjectInfo[];
  project_ids?: string[];
  paper_id: string;
  title: string;
  authors: string;
  venue: string;
  year: number | null;
  published: string;
  summary: string;
  pdf_url: string;
  entry_url: string;
  primary_category: string;
  file_name: string;
  storage_path: string | null;
  file_size: number;
  file_size_label: string;
  tags: string[];
  downloaded_at: string;
  status: "analyzed" | "pending";
  analyzed_at?: string;
  insights?: any;
  chunks_count?: number;
  figures_count?: number;
  vectors_count?: number;
}

export interface UserProject {
  id: string;
  title: string;
  color: string;
  domain: string;
  papers_count: number;
}

function getProjectBadgeStyle(color?: string) {
  switch (color) {
    case "tertiary":
      return "border-tertiary/30 bg-tertiary/10 text-tertiary";
    case "secondary":
      return "border-secondary/30 bg-secondary/10 text-secondary";
    case "emerald":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "amber":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "rose":
      return "border-rose-500/30 bg-rose-500/10 text-rose-400";
    case "cyan":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-400";
    case "primary":
    default:
      return "border-primary/30 bg-primary/10 text-primary";
  }
}

export default function GlobalDocumentsCenter() {
  const [papers, setPapers] = useState<GlobalPaper[]>([]);
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [sortOption, setSortOption] = useState<
    "newest" | "oldest" | "az" | "za" | "year_desc" | "year_asc" | "size"
  >("newest");

  // Selection
  const [selectedPaperKeys, setSelectedPaperKeys] = useState<string[]>([]);

  // Modals
  const [inspectPaper, setInspectPaper] = useState<GlobalPaper | null>(null);
  const [importTargetPapers, setImportTargetPapers] = useState<GlobalPaper[] | null>(null);
  const [selectedDestinationProjectId, setSelectedDestinationProjectId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (projectFilter && projectFilter !== "all") params.set("project_id", projectFilter);
      if (yearFilter && yearFilter !== "all") params.set("year", yearFilter);
      if (sortOption) params.set("sort", sortOption);

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPapers(data.papers || []);
        if (Array.isArray(data.projects)) {
          setProjects(data.projects);
          if (!selectedDestinationProjectId && data.projects.length > 0) {
            setSelectedDestinationProjectId(data.projects[0].id);
          }
        }
        if (Array.isArray(data.availableYears)) {
          setAvailableYears(data.availableYears);
        }
      }
    } catch (err) {
      console.error("Failed to load global documents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [projectFilter, yearFilter, sortOption]);

  // Client-side search filtering
  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return papers;
    const q = searchQuery.toLowerCase();
    return papers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.venue.toLowerCase().includes(q) ||
        p.project_title.toLowerCase().includes(q) ||
        (p.projects && p.projects.some((pr) => pr.project_title.toLowerCase().includes(q))) ||
        p.paper_id.toLowerCase().includes(q) ||
        (p.summary && p.summary.toLowerCase().includes(q))
    );
  }, [papers, searchQuery]);

  // Key generator for multi-selection: paper_id
  const getPaperKey = (paper: GlobalPaper) => paper.paper_id;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPaperKeys(filteredPapers.map(getPaperKey));
    } else {
      setSelectedPaperKeys([]);
    }
  };

  const handleToggleRow = (paper: GlobalPaper) => {
    const key = getPaperKey(paper);
    setSelectedPaperKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Metrics
  const totalCount = papers.length;
  const totalSizeBytes = useMemo(() => {
    return papers.reduce((acc, p) => acc + (Number(p.file_size) || 0), 0);
  }, [papers]);

  const totalStorageLabel = useMemo(() => {
    if (totalSizeBytes > 1024 * 1024) {
      return `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(totalSizeBytes / 1024)} KB`;
  }, [totalSizeBytes]);

  // Open import modal for single paper
  const handleOpenSingleImport = (paper: GlobalPaper) => {
    setImportTargetPapers([paper]);
    const existingIds = paper.project_ids || [paper.project_id];
    const altProject = projects.find((p) => !existingIds.includes(p.id));
    setSelectedDestinationProjectId(altProject?.id || "");
  };

  // Open import modal for bulk selection
  const handleOpenBulkImport = () => {
    const selected = papers.filter((p) => selectedPaperKeys.includes(getPaperKey(p)));
    if (selected.length === 0) return;
    setImportTargetPapers(selected);
    const altProject = projects.find(
      (p) => !selected.every((item) => (item.project_ids || [item.project_id]).includes(p.id))
    );
    setSelectedDestinationProjectId(altProject?.id || "");
  };

  // Execute import to target project
  const handleExecuteImport = async () => {
    if (!importTargetPapers || importTargetPapers.length === 0 || !selectedDestinationProjectId) {
      return;
    }

    try {
      setIsImporting(true);
      const payload = {
        targetProjectId: selectedDestinationProjectId,
        items: importTargetPapers.map((p) => ({
          paperId: p.paper_id,
          sourceProjectId: p.project_id,
        })),
      };

      const res = await fetch("/api/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import paper(s)");
      }

      setImportSuccessMessage(
        `Successfully imported ${data.importedCount} paper(s) into "${data.targetProjectTitle}".`
      );
      setImportTargetPapers(null);
      setSelectedPaperKeys([]);

      // Refresh list to show newly indexed project document
      await fetchDocuments();

      setTimeout(() => {
        setImportSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error("Import execution failed:", err);
      alert(err instanceof Error ? err.message : "Failed to import paper. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-background font-body-md selection:bg-primary/30 antialiased">
      {/* Left Sidebar (Main Dashboard AppSidebar with All Documents Active) */}
      <AppSidebar activeTab="All Documents" />

      {/* Main Content Area - Full height scroll container */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto custom-scrollbar relative bg-background">
        {/* Decorative Ambient Glow */}
        <div className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[350px] h-[350px] bg-tertiary/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Inner Content Area */}
        <div className="p-6 md:p-8 flex flex-col gap-6 max-w-[1600px] w-full min-w-0 mx-auto">
          {/* Top Success Banner */}
          {importSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between gap-3 animate-fade-in shadow-lg">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-emerald-400 text-xl">
                  check_circle
                </span>
                <span className="text-sm font-medium">{importSuccessMessage}</span>
              </div>
              <button
                onClick={() => setImportSuccessMessage(null)}
                className="text-emerald-400 hover:text-emerald-200"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* Top Header & Context */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary text-xl">
                  folder_shared
                </span>
                <span className="font-label-md text-xs uppercase tracking-wider text-primary font-semibold">
                  Global Document Repository
                </span>
              </div>
              <h1 className="font-headline-lg text-2xl md:text-3xl font-bold tracking-tight text-on-surface">
                All Documents
              </h1>
              <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
                Consolidated index of all downloaded and uploaded PDF research manuscripts across your workspaces. Share or import papers directly into other projects without duplicate downloads.
              </p>
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <div className="glass-panel px-3.5 py-2 rounded-lg flex items-center gap-2 text-xs border border-outline-variant/30 bg-surface-container-low">
                <span className="material-symbols-outlined text-primary text-base">
                  description
                </span>
                <span className="text-on-surface-variant">Total PDF Papers:</span>
                <span className="font-bold text-on-surface font-mono">{totalCount}</span>
              </div>
              <div className="glass-panel px-3.5 py-2 rounded-lg flex items-center gap-2 text-xs border border-outline-variant/30 bg-surface-container-low">
                <span className="material-symbols-outlined text-tertiary text-base">
                  folder_open
                </span>
                <span className="text-on-surface-variant">Workspaces:</span>
                <span className="font-bold text-tertiary font-mono">{projects.length}</span>
              </div>
              <div className="glass-panel px-3.5 py-2 rounded-lg flex items-center gap-2 text-xs border border-outline-variant/30 bg-surface-container-low">
                <span className="material-symbols-outlined text-secondary text-base">
                  inventory_2
                </span>
                <span className="text-on-surface-variant">Cloud Storage:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {totalStorageLabel}
                </span>
              </div>
              <Link
                href="/projects"
                className="px-3.5 py-2 bg-surface-container-high border border-outline-variant/40 hover:bg-surface-variant text-on-surface rounded-lg text-xs font-label-md font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                title="View all projects"
              >
                <span className="material-symbols-outlined text-base text-primary">folder_open</span>
                <span>Projects Hub</span>
              </Link>
            </div>
          </div>

          {/* Toolbar: Search, Project Filter, Year Filter, Sorting & Import Actions */}
          <div className="glass-panel p-4 rounded-xl flex flex-col xl:flex-row xl:items-center justify-between gap-4 border border-outline-variant/30 ink-shadow bg-surface-container-low">
            {/* Left: Checkbox Select All, Selection Count & Bulk Import Button */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer bg-surface-container-high/60 px-3 py-1.5 rounded-lg border border-outline-variant/40 hover:border-primary/40 transition-colors">
                <input
                  type="checkbox"
                  checked={
                    selectedPaperKeys.length > 0 &&
                    selectedPaperKeys.length === filteredPapers.length
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0 bg-surface-container-high cursor-pointer"
                />
                <span className="font-label-md text-xs text-on-surface font-medium select-none">
                  Select All ({filteredPapers.length})
                </span>
              </label>

              {selectedPaperKeys.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-container-highest text-primary font-medium border border-outline-variant/30">
                    {selectedPaperKeys.length} selected
                  </span>
                  <button
                    onClick={handleOpenBulkImport}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-label-md font-semibold bg-primary text-on-primary hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-primary/20"
                    title="Import selected papers into another project"
                  >
                    <span className="material-symbols-outlined text-sm">library_add</span>
                    <span>Import Selected to Project ({selectedPaperKeys.length})</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right: Search Input, Project Filter, Year Filter, Sort Dropdown */}
            <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
              {/* Search Input */}
              <div className="relative flex-grow sm:flex-grow-0 sm:w-72">
                <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-on-surface-variant text-base">
                  search
                </span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-surface-container-high border border-outline-variant/40 rounded-lg text-xs font-label-md text-on-surface focus:outline-none focus:border-primary w-full transition-all placeholder:text-on-surface-variant/60"
                  placeholder="Search title, author, venue, project..."
                  type="text"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2 text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              {/* Filter by Project */}
              <div className="flex items-center gap-1.5 bg-surface-container-high px-2 py-1 rounded-lg border border-outline-variant/40">
                <span className="material-symbols-outlined text-on-surface-variant text-sm">
                  folder
                </span>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="bg-transparent text-xs font-label-md text-on-surface focus:outline-none cursor-pointer pr-2 max-w-[150px] truncate"
                  title="Filter by Project Workspace"
                >
                  <option value="all" className="bg-surface-container-high">
                    All Projects
                  </option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id} className="bg-surface-container-high">
                      {proj.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter by Year */}
              <div className="flex items-center gap-1.5 bg-surface-container-high px-2 py-1 rounded-lg border border-outline-variant/40">
                <span className="material-symbols-outlined text-on-surface-variant text-sm">
                  calendar_today
                </span>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="bg-transparent text-xs font-label-md text-on-surface focus:outline-none cursor-pointer pr-2"
                  title="Filter by Publication Year"
                >
                  <option value="all" className="bg-surface-container-high">
                    All Years
                  </option>
                  {availableYears.map((yr) => (
                    <option
                      key={yr}
                      value={yr.toString()}
                      className="bg-surface-container-high"
                    >
                      Year {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 bg-surface-container-high px-2 py-1 rounded-lg border border-outline-variant/40">
                <span className="material-symbols-outlined text-on-surface-variant text-sm">
                  sort
                </span>
                <select
                  value={sortOption}
                  onChange={(e) =>
                    setSortOption(
                      e.target.value as
                        | "newest"
                        | "oldest"
                        | "az"
                        | "za"
                        | "year_desc"
                        | "year_asc"
                        | "size"
                    )
                  }
                  className="bg-transparent text-xs font-label-md text-on-surface focus:outline-none cursor-pointer pr-2"
                  title="Sort Documents"
                >
                  <option value="newest" className="bg-surface-container-high">
                    Sort: Newest First
                  </option>
                  <option value="oldest" className="bg-surface-container-high">
                    Sort: Oldest First
                  </option>
                  <option value="az" className="bg-surface-container-high">
                    Sort: A to Z
                  </option>
                  <option value="za" className="bg-surface-container-high">
                    Sort: Z to A
                  </option>
                  <option value="year_desc" className="bg-surface-container-high">
                    Sort: Year (Newest)
                  </option>
                  <option value="year_asc" className="bg-surface-container-high">
                    Sort: Year (Oldest)
                  </option>
                  <option value="size" className="bg-surface-container-high">
                    Sort: File Size
                  </option>
                </select>
              </div>

              {/* Reset Filters */}
              {(searchQuery || projectFilter !== "all" || yearFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setProjectFilter("all");
                    setYearFilter("all");
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-label-md text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1 cursor-pointer"
                  title="Clear Filters"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Documents Table */}
          <div className="glass-panel rounded-xl border border-outline-variant/30 overflow-hidden ink-shadow bg-surface-container-low">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-low font-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                    <th className="p-4 w-12 text-center">#</th>
                    <th className="p-4 min-w-[320px]">
                      Research Paper Title &amp; Publication
                    </th>
                    <th className="p-4 min-w-[180px]">Project &amp; Category</th>
                    <th className="p-4 min-w-[120px] text-center">Analysis</th>
                    <th className="p-4 min-w-[130px]">Size &amp; Stored</th>
                    <th className="p-4 text-center w-24">Year</th>
                    <th className="p-4 text-right w-48">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-label-md text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-on-surface-variant">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-3xl animate-spin text-primary">
                            progress_activity
                          </span>
                          <span>Loading documents across all projects...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPapers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-on-surface-variant">
                        <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
                          <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-outline">
                            <span className="material-symbols-outlined text-2xl">
                              description
                            </span>
                          </div>
                          <div className="font-semibold text-on-surface text-base">
                            No documents found
                          </div>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            {searchQuery || projectFilter !== "all" || yearFilter !== "all"
                              ? "No research papers matched your filters. Try adjusting your search query."
                              : "No PDF manuscripts have been downloaded or uploaded yet. Open any project workspace to search and add literature."}
                          </p>
                          <div className="flex items-center gap-3 pt-2">
                            <Link
                              href="/projects"
                              className="px-4 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-label-md font-semibold hover:brightness-110 cursor-pointer"
                            >
                              Open Projects Hub
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPapers.map((paper) => {
                      const paperKey = getPaperKey(paper);
                      const isChecked = selectedPaperKeys.includes(paperKey);
                      const privatePdfUrl = paper.storage_path
                        ? `/api/projects/${encodeURIComponent(paper.project_id)}/papers/${encodeURIComponent(
                            paper.paper_id || paper.id
                          )}/file`
                        : null;
                      const openUrl = paper.entry_url || paper.pdf_url || privatePdfUrl || "#";

                      return (
                        <tr
                          key={paperKey}
                          className={`hover:bg-surface-container-high/40 transition-colors ${
                            isChecked ? "bg-primary/5" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRow(paper)}
                              className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0 bg-surface-container-high cursor-pointer"
                            />
                          </td>

                          {/* Paper Title & Source */}
                          <td className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-lg border border-primary/20 bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-lg">
                                  article
                                </span>
                              </div>
                              <div className="min-w-0">
                                <a
                                  href={openUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-on-surface text-sm hover:text-primary transition-colors inline-flex items-center gap-1 text-left cursor-pointer group"
                                  title="Open Paper Online"
                                >
                                  <span className="line-clamp-2">{paper.title}</span>
                                  <span className="material-symbols-outlined text-xs text-outline group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0">
                                    north_east
                                  </span>
                                </a>
                                <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-2 flex-wrap">
                                  <span>{paper.authors || "Unknown Authors"}</span>
                                  {paper.paper_id && (
                                    <span className="font-mono text-[11px] px-1.5 py-0.2 bg-surface-container-highest rounded text-outline">
                                      {paper.paper_id}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Source Projects & Category */}
                          <td className="p-4 font-mono text-xs">
                            <div className="flex flex-col gap-1.5 items-start">
                              <div className="flex flex-wrap gap-1 max-w-[240px]">
                                {(paper.projects && paper.projects.length > 0
                                  ? paper.projects
                                  : [
                                      {
                                        project_id: paper.project_id,
                                        project_title: paper.project_title,
                                        project_color: paper.project_color,
                                      },
                                    ]
                                ).map((proj) => (
                                  <Link
                                    key={proj.project_id}
                                    href={`/projects/${proj.project_id}/library`}
                                    className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 hover:brightness-125 transition-all ${getProjectBadgeStyle(
                                      proj.project_color
                                    )}`}
                                    title={`Open ${proj.project_title} workspace`}
                                  >
                                    <span className="material-symbols-outlined text-xs">folder</span>
                                    <span className="truncate max-w-[130px]">{proj.project_title}</span>
                                  </Link>
                                ))}
                              </div>
                              <span className="px-2 py-0.2 rounded text-[10px] bg-surface-container-highest text-on-surface-variant border border-outline-variant/30">
                                {paper.venue || paper.primary_category || "Academic"}
                              </span>
                            </div>
                          </td>

                          {/* Analysis Status */}
                          <td className="p-4 text-center">
                            {paper.status === "analyzed" ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                title="Vectors and chunks indexed for AI retrieval"
                              >
                                <span className="material-symbols-outlined text-xs">verified</span>
                                <span>Analyzed</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-container-highest text-outline border border-outline-variant/30"
                                title="Raw manuscript ready for analysis"
                              >
                                <span className="material-symbols-outlined text-xs">schedule</span>
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* File Size & Stored Date */}
                          <td className="p-4 font-mono text-xs text-on-surface-variant">
                            <div className="text-on-surface font-medium">
                              {paper.file_size_label || "PDF Document"}
                            </div>
                            <div className="text-[11px] text-outline mt-0.5">
                              {paper.downloaded_at
                                ? new Date(paper.downloaded_at).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "Archived"}
                            </div>
                          </td>

                          {/* Year */}
                          <td className="p-4 text-center">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-surface-container-highest text-on-surface font-semibold border border-outline-variant/30">
                              {paper.year || "—"}
                            </span>
                          </td>

                          {/* Actions: View Abstract, Open PDF, Import to Project */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Abstract inspection */}
                              {paper.summary && (
                                <button
                                  onClick={() => setInspectPaper(paper)}
                                  className="px-2 py-1 rounded text-xs font-label-md bg-surface-container-high border border-outline-variant/40 hover:border-primary text-on-surface hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Read Abstract / Summary"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    subject
                                  </span>
                                  <span>Abstract</span>
                                </button>
                              )}

                              {/* Direct PDF View / Download */}
                              {privatePdfUrl && (
                                <a
                                  href={privatePdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 rounded text-xs font-label-md bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-on-primary transition-all flex items-center gap-1 cursor-pointer"
                                  title="Open / Download Stored PDF"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    picture_as_pdf
                                  </span>
                                  <span>PDF</span>
                                </a>
                              )}

                              {/* Cross-Project Import Action */}
                              <button
                                onClick={() => handleOpenSingleImport(paper)}
                                className="px-2.5 py-1 rounded text-xs font-label-md bg-tertiary/15 border border-tertiary/40 text-tertiary hover:bg-tertiary hover:text-on-tertiary transition-all flex items-center gap-1 cursor-pointer shadow-sm font-semibold"
                                title="Import this paper into another project workspace without duplicate downloading"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  library_add
                                </span>
                                <span>Import</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Abstract Modal */}
        {inspectPaper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
            <div className="glass-panel w-full max-w-2xl bg-surface-container-low border border-primary/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="p-5 border-b border-outline-variant/30 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">article</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-primary uppercase tracking-wider font-semibold">
                      Paper Details • {inspectPaper.year || "Preprint"} • Workspace: {inspectPaper.project_title}
                    </span>
                    <h3 className="font-bold text-base md:text-lg text-on-surface leading-snug line-clamp-2">
                      {inspectPaper.title}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setInspectPaper(null)}
                  className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 text-sm">
                <div>
                  <div className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">
                    Authors
                  </div>
                  <div className="text-on-surface font-medium">
                    {inspectPaper.authors || "Not listed"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">
                      Current Workspace
                    </div>
                    <div className="text-on-surface font-semibold text-primary">
                      {inspectPaper.project_title}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">
                      Analysis Status
                    </div>
                    <div className="text-on-surface font-medium">
                      {inspectPaper.status === "analyzed"
                        ? "Indexed & Ready for Q&A"
                        : "Raw PDF Manuscript"}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">
                    Abstract &amp; Summary
                  </div>
                  <div className="p-4 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 text-on-surface-variant leading-relaxed text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {inspectPaper.summary || "No abstract available for this manuscript."}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-outline-variant/30 bg-surface-container-high/40 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    const p = inspectPaper;
                    setInspectPaper(null);
                    handleOpenSingleImport(p);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-label-md bg-tertiary/15 border border-tertiary/30 text-tertiary hover:bg-tertiary hover:text-on-tertiary font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">library_add</span>
                  <span>Import to Another Project</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInspectPaper(null)}
                    className="px-4 py-2 rounded-lg text-xs font-label-md bg-surface-container text-on-surface hover:bg-surface-container-highest cursor-pointer transition-colors"
                  >
                    Close
                  </button>
                  {(() => {
                    const privatePdfUrl = inspectPaper.storage_path
                      ? `/api/projects/${encodeURIComponent(inspectPaper.project_id)}/papers/${encodeURIComponent(
                          inspectPaper.paper_id || inspectPaper.id
                        )}/file`
                      : null;
                    const targetUrl = inspectPaper.entry_url || inspectPaper.pdf_url || privatePdfUrl;
                    if (!targetUrl) return null;
                    return (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg text-xs font-label-md bg-primary text-on-primary hover:brightness-110 font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-primary/20"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        <span>Open Document</span>
                      </a>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cross-Project Import Modal (Blur Dialog) */}
        {importTargetPapers && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="glass-panel w-full max-w-xl bg-surface-container-low border border-tertiary/40 rounded-2xl shadow-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-tertiary/20 text-tertiary border border-tertiary/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">
                      drive_file_move
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-on-surface">
                      {importTargetPapers.length === 1
                        ? "Import Paper to Project"
                        : `Import ${importTargetPapers.length} Papers to Project`}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Share research manuscripts into another workspace without duplicate PDF downloads
                    </p>
                  </div>
                </div>
                <button
                  disabled={isImporting}
                  onClick={() => setImportTargetPapers(null)}
                  className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Papers to import preview */}
              <div className="p-3.5 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 text-xs flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                <span className="text-[10px] uppercase font-semibold text-outline tracking-wider">
                  Selected Literature:
                </span>
                {importTargetPapers.map((p) => (
                  <div
                    key={getPaperKey(p)}
                    className="flex items-center justify-between gap-3 py-1 border-b border-outline-variant/20 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-on-surface truncate">{p.title}</div>
                      <div className="text-[11px] text-outline truncate">
                        From: {p.project_title} • {p.authors || "Unknown Authors"}
                      </div>
                    </div>
                    {p.status === "analyzed" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30 whitespace-nowrap">
                        Analyzed
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-outline whitespace-nowrap">
                        Pending
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Analysis reuse callout */}
              {importTargetPapers.some((p) => p.status === "analyzed") && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-emerald-300 leading-relaxed">
                  <span className="material-symbols-outlined text-emerald-400 text-base shrink-0 mt-0.5">
                    bolt
                  </span>
                  <div>
                    <strong className="text-emerald-200">Instant AI Knowledge Sharing:</strong> Extracted
                    text chunks, visual figures, and vector embeddings will be copied automatically so
                    the target project can query this paper immediately in the Research Chatbot!
                  </div>
                </div>
              )}

              {/* Project Destination Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-on-surface">
                  Choose Destination Project Workspace:
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {projects.map((proj) => {
                    const isSelected = selectedDestinationProjectId === proj.id;
                    const isAlreadyInProject =
                      importTargetPapers.length === 1
                        ? (importTargetPapers[0].project_ids || [importTargetPapers[0].project_id]).includes(
                            proj.id
                          )
                        : importTargetPapers.every((p) =>
                            (p.project_ids || [p.project_id]).includes(proj.id)
                          );

                    return (
                      <div
                        key={proj.id}
                        onClick={() => {
                          if (!isAlreadyInProject) {
                            setSelectedDestinationProjectId(proj.id);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-tertiary/15 border-tertiary text-on-surface shadow-sm ring-1 ring-tertiary/50"
                            : isAlreadyInProject
                            ? "bg-surface-container-low/50 border-outline-variant/20 opacity-50 cursor-not-allowed"
                            : "bg-surface-container-high/40 border-outline-variant/30 hover:border-outline-variant hover:bg-surface-container-high text-on-surface"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${getProjectBadgeStyle(
                              proj.color
                            )}`}
                          >
                            <span className="material-symbols-outlined text-base">folder</span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                              <span>{proj.title}</span>
                              {isAlreadyInProject && (
                                <span className="text-[10px] text-outline font-normal">
                                  (Already in this project)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-outline truncate">
                              Domain: {proj.domain || "General Academic"} • {proj.papers_count || 0} papers
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <input
                            type="radio"
                            name="destinationProject"
                            checked={isSelected}
                            disabled={isAlreadyInProject}
                            onChange={() => {
                              if (!isAlreadyInProject) {
                                setSelectedDestinationProjectId(proj.id);
                              }
                            }}
                            className="w-4 h-4 text-tertiary focus:ring-0 bg-surface-container-high cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/30">
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => setImportTargetPapers(null)}
                  className="px-4 py-2 rounded-lg text-xs font-label-md bg-surface-container text-on-surface hover:bg-surface-container-highest cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isImporting || !selectedDestinationProjectId}
                  onClick={handleExecuteImport}
                  className="px-5 py-2 rounded-lg text-xs font-label-md bg-tertiary text-on-tertiary font-bold hover:brightness-110 flex items-center gap-1.5 cursor-pointer shadow-md shadow-tertiary/20 disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">
                        progress_activity
                      </span>
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">library_add</span>
                      <span>
                        Import {importTargetPapers.length === 1 ? "Paper" : `${importTargetPapers.length} Papers`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
