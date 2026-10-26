"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import ProjectSidebar from "@/components/common/ProjectSidebar";

export interface LibraryPaper {
  id: string;
  project_id: string;
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
  status?: string;
  analyzed_at?: string;
  insights?: any;
  chunks_count?: number;
  figures_count?: number;
  vectors_count?: number;
}

interface ProjectPaperLibraryProps {
  projectId: string;
}

export default function ProjectPaperLibrary({ projectId }: ProjectPaperLibraryProps) {
  const [papers, setPapers] = useState<LibraryPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "papers" | "reports">("all");
  const [sortOption, setSortOption] = useState<
    "az" | "za" | "newest" | "oldest" | "year_desc" | "year_asc" | "size"
  >("az");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [inspectPaper, setInspectPaper] = useState<LibraryPaper | null>(null);
  const [projectName, setProjectName] = useState<string>("");

  // Deletion states
  const [deleteTarget, setDeleteTarget] = useState<LibraryPaper | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPapers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (yearFilter && yearFilter !== "all") params.set("year", yearFilter);
      if (sortOption) params.set("sort", sortOption);

      const res = await fetch(`/api/projects/${projectId}/papers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPapers(data.papers || []);
        if (data.availableYears && data.availableYears.length > 0) {
          setAvailableYears(data.availableYears);
        }
      }
    } catch (err) {
      console.error("Failed to fetch library papers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, [projectId, yearFilter, sortOption]);

  // Load project details
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.project?.title) {
          setProjectName(data.project.title);
        }
      })
      .catch(() => {});
  }, [projectId]);

  // Handle client-side filtering (search and item type: paper vs report)
  const filteredPapers = useMemo(() => {
    let result = papers;

    // Filter by type
    if (typeFilter === "papers") {
      result = result.filter(
        (p) => p.primary_category !== "Generated Report" && p.status !== "report"
      );
    } else if (typeFilter === "reports") {
      result = result.filter(
        (p) => p.primary_category === "Generated Report" || p.status === "report"
      );
    }

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.venue.toLowerCase().includes(q) ||
        p.paper_id.toLowerCase().includes(q) ||
        (p.summary && p.summary.toLowerCase().includes(q))
    );
  }, [papers, searchQuery, typeFilter]);

  // Metrics
  const totalCount = papers.length;
  const reportsCount = useMemo(
    () => papers.filter((p) => p.primary_category === "Generated Report" || p.status === "report").length,
    [papers]
  );
  const papersCount = totalCount - reportsCount;

  const totalSizeBytes = useMemo(() => {
    return papers.reduce((acc, p) => acc + (Number(p.file_size) || 0), 0);
  }, [papers]);

  const totalStorageLabel = useMemo(() => {
    if (totalSizeBytes > 1024 * 1024) {
      return `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(totalSizeBytes / 1024)} KB`;
  }, [totalSizeBytes]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPaperIds(filteredPapers.map((p) => p.id));
    } else {
      setSelectedPaperIds([]);
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedPaperIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Single paper/report deletion
  const handleDeleteSingle = async (paper: LibraryPaper) => {
    try {
      setIsDeleting(true);
      const targetId = paper.paper_id || paper.id;
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/papers/${encodeURIComponent(targetId)}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) throw new Error("Failed to delete item");

      setPapers((prev) => prev.filter((p) => p.id !== paper.id && p.paper_id !== paper.paper_id));
      setSelectedPaperIds((prev) => prev.filter((id) => id !== paper.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete item. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk deletion
  const handleDeleteBulk = async () => {
    if (selectedPaperIds.length === 0) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/papers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperIds: selectedPaperIds }),
      });
      if (!res.ok) throw new Error("Failed to delete selected items");

      setPapers((prev) =>
        prev.filter((p) => !selectedPaperIds.includes(p.id) && !selectedPaperIds.includes(p.paper_id))
      );
      setSelectedPaperIds([]);
      setShowBulkDeleteConfirm(false);
    } catch (err) {
      console.error("Bulk delete failed:", err);
      alert("Failed to delete selected items. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-on-surface font-sans antialiased">
      {/* Shared Project Sidebar with Library Tab Active */}
      <ProjectSidebar
        projectId={projectId}
        projectName={projectName}
        activeTab="library"
      />

      {/* Main Library Content Area */}
      <main className="flex-1 ml-sidebar-width p-6 md:p-8 flex flex-col gap-6 max-w-[1600px] w-full min-w-0">
        {/* Top Header & Project Context */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-xl">
                library_books
              </span>
              <span className="font-label-md text-xs uppercase tracking-wider text-primary font-semibold">
                All Documents
              </span>
            </div>
            <h1 className="font-headline-lg text-2xl md:text-3xl font-bold tracking-tight text-on-surface">
              All Documents
            </h1>
            <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
              Archived research literature and AI synthesis reports for{" "}
              <span className="text-primary font-medium">
                {projectName || projectId}
              </span>
              . Download, review, or clean up stored items to save cloud storage.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <div className="glass-panel px-3.5 py-2 rounded-lg flex items-center gap-2 text-xs border border-outline-variant/30 bg-surface-container-low">
              <span className="material-symbols-outlined text-primary text-base">
                description
              </span>
              <span className="text-on-surface-variant">Papers:</span>
              <span className="font-bold text-on-surface font-mono">{papersCount}</span>
            </div>
            {reportsCount > 0 && (
              <div className="glass-panel px-3.5 py-2 rounded-lg flex items-center gap-2 text-xs border border-amber-500/30 bg-amber-500/5">
                <span className="material-symbols-outlined text-amber-400 text-base">
                  auto_awesome_motion
                </span>
                <span className="text-amber-200/80">AI Reports:</span>
                <span className="font-bold text-amber-300 font-mono">{reportsCount}</span>
              </div>
            )}
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
              href={`/projects/${projectId}/analysis?tab=upload`}
              className="px-3.5 py-2 bg-surface-container-high border border-outline-variant/40 hover:bg-surface-variant text-on-surface rounded-lg text-xs font-label-md font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Upload PDF manuscript to project"
            >
              <span className="material-symbols-outlined text-base text-primary">cloud_upload</span>
              <span>Upload PDF</span>
            </Link>
            <Link
              href={`/projects/${projectId}/chatbot`}
              className="px-3.5 py-2 bg-primary text-on-primary hover:brightness-110 rounded-lg text-xs font-label-md font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">smart_toy</span>
              <span>Research Chatbot</span>
            </Link>
          </div>
        </div>

        {/* Toolbar: Category Filter, Search, Year Filter, Sorting & Bulk Actions */}
        <div className="glass-panel p-4 rounded-xl flex flex-col xl:flex-row xl:items-center justify-between gap-4 border border-outline-variant/30 ink-shadow bg-surface-container-low">
          {/* Left: Checkbox Select All, Selection Count & Bulk Delete */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer bg-surface-container-high/60 px-3 py-1.5 rounded-lg border border-outline-variant/40 hover:border-primary/40 transition-colors">
              <input
                type="checkbox"
                checked={
                  selectedPaperIds.length > 0 &&
                  selectedPaperIds.length === filteredPapers.length
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0 bg-surface-container-high cursor-pointer"
              />
              <span className="font-label-md text-xs text-on-surface font-medium select-none">
                Select All ({filteredPapers.length})
              </span>
            </label>

            {selectedPaperIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-container-highest text-primary font-medium border border-outline-variant/30">
                  {selectedPaperIds.length} selected
                </span>
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-label-md font-semibold bg-error/15 border border-error/30 text-error hover:bg-error hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Delete all selected items and free cloud storage"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete Selected ({selectedPaperIds.length})</span>
                </button>
              </div>
            )}

            {/* Type Filter Pills: All / Papers / Reports */}
            <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded-lg border border-outline-variant/30">
              <button
                onClick={() => setTypeFilter("all")}
                className={`px-2.5 py-1 rounded text-xs font-label-md transition-colors cursor-pointer ${
                  typeFilter === "all"
                    ? "bg-primary text-on-primary font-semibold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setTypeFilter("papers")}
                className={`px-2.5 py-1 rounded text-xs font-label-md transition-colors cursor-pointer ${
                  typeFilter === "papers"
                    ? "bg-primary text-on-primary font-semibold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Papers ({papersCount})
              </button>
              <button
                onClick={() => setTypeFilter("reports")}
                className={`px-2.5 py-1 rounded text-xs font-label-md transition-colors cursor-pointer ${
                  typeFilter === "reports"
                    ? "bg-amber-500 text-black font-semibold shadow-sm"
                    : "text-amber-300/80 hover:text-amber-200"
                }`}
              >
                AI Reports ({reportsCount})
              </button>
            </div>
          </div>

          {/* Right: Search Input, Year Filter Dropdown, Sort Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
            {/* Search Input */}
            <div className="relative flex-grow sm:flex-grow-0 sm:w-80">
              <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-on-surface-variant text-base">
                search
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 bg-surface-container-high border border-outline-variant/40 rounded-lg text-xs font-label-md text-on-surface focus:outline-none focus:border-primary w-full transition-all placeholder:text-on-surface-variant/60"
                placeholder="Search by title, author, venue, keyword..."
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
                      | "az"
                      | "za"
                      | "newest"
                      | "oldest"
                      | "year_desc"
                      | "year_asc"
                      | "size"
                  )
                }
                className="bg-transparent text-xs font-label-md text-on-surface focus:outline-none cursor-pointer pr-2"
                title="Sort Paper Library"
              >
                <option value="az" className="bg-surface-container-high">
                  Sort: A to Z
                </option>
                <option value="za" className="bg-surface-container-high">
                  Sort: Z to A
                </option>
                <option value="newest" className="bg-surface-container-high">
                  Sort: Newest Downloaded
                </option>
                <option value="oldest" className="bg-surface-container-high">
                  Sort: Oldest Downloaded
                </option>
                <option value="year_desc" className="bg-surface-container-high">
                  Sort: Year (Newest First)
                </option>
                <option value="year_asc" className="bg-surface-container-high">
                  Sort: Year (Oldest First)
                </option>
                <option value="size" className="bg-surface-container-high">
                  Sort: File Size
                </option>
              </select>
            </div>

            {/* Clear Filters Button if any active */}
            {(searchQuery || yearFilter !== "all" || typeFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setYearFilter("all");
                  setTypeFilter("all");
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

        {/* Papers Table */}
        <div className="glass-panel rounded-xl border border-outline-variant/30 overflow-hidden ink-shadow bg-surface-container-low">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-low font-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4 min-w-[340px]">
                    Document Title &amp; Source
                  </th>
                  <th className="p-4 min-w-[160px]">Category &amp; Tags</th>
                  <th className="p-4 min-w-[140px]">Size &amp; Stored</th>
                  <th className="p-4 text-center w-28">Type / Year</th>
                  <th className="p-4 text-right w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-label-md text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-3xl animate-spin text-primary">
                          progress_activity
                        </span>
                        <span>Loading project library...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPapers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
                        <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-outline">
                          <span className="material-symbols-outlined text-2xl">
                            library_books
                          </span>
                        </div>
                        <div className="font-semibold text-on-surface text-base">
                          No items found
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {searchQuery || yearFilter !== "all" || typeFilter !== "all"
                            ? "No items matched your search or filters. Try adjusting your filter settings."
                            : "No papers or generated reports stored for this project yet. Use the Chatbot to find papers or generate comprehensive research reports."}
                        </p>
                        <div className="flex items-center gap-3 pt-2">
                          {(searchQuery || yearFilter !== "all" || typeFilter !== "all") && (
                            <button
                              onClick={() => {
                                setSearchQuery("");
                                setYearFilter("all");
                                setTypeFilter("all");
                              }}
                              className="px-4 py-1.5 bg-surface-container-high border border-outline-variant/40 rounded-lg text-xs font-label-md hover:bg-surface-container cursor-pointer"
                            >
                              Reset Filters
                            </button>
                          )}
                          <Link
                            href={`/projects/${projectId}/analysis?tab=upload`}
                            className="px-4 py-1.5 bg-surface-container-high border border-outline-variant/40 hover:bg-surface-variant text-on-surface rounded-lg text-xs font-label-md font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm text-primary">cloud_upload</span>
                            <span>Upload PDF</span>
                          </Link>
                          <Link
                            href={`/projects/${projectId}/chatbot`}
                            className="px-4 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-label-md font-semibold hover:brightness-110 cursor-pointer"
                          >
                            Open Research Chatbot
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPapers.map((paper) => {
                    const isChecked = selectedPaperIds.includes(paper.id);
                    const isReport =
                      paper.primary_category === "Generated Report" || paper.status === "report";

                    const privatePdfUrl = paper.storage_path
                      ? `/api/projects/${encodeURIComponent(projectId)}/papers/${encodeURIComponent(
                          paper.paper_id || paper.id
                        )}/file`
                      : null;
                    const docxDownloadUrl = privatePdfUrl ? `${privatePdfUrl}?format=docx` : null;
                    const openUrl = paper.entry_url || paper.pdf_url || privatePdfUrl || "#";

                    return (
                      <tr
                        key={paper.id}
                        className={`hover:bg-surface-container-high/40 transition-colors ${
                          isChecked ? "bg-primary/5" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleRow(paper.id)}
                            className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0 bg-surface-container-high cursor-pointer"
                          />
                        </td>

                        {/* Title & Document Details */}
                        <td className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Icon differentiates report vs paper */}
                            <div
                              className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                isReport
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                  : "border-primary/20 bg-primary/10 text-primary"
                              }`}
                            >
                              <span className="material-symbols-outlined text-lg">
                                {isReport ? "description" : "article"}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                {isReport && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    AI Report
                                  </span>
                                )}
                                <a
                                  href={openUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-on-surface text-sm hover:text-primary transition-colors inline-flex items-center gap-1 text-left cursor-pointer group"
                                  title={isReport ? "Open Report PDF" : "Open Paper Online"}
                                >
                                  <span className="line-clamp-2">{paper.title}</span>
                                  <span className="material-symbols-outlined text-xs text-outline group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0">
                                    north_east
                                  </span>
                                </a>
                              </div>
                              <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-2 flex-wrap">
                                <span>{paper.authors || (isReport ? "ResearchPilot AI" : "Unknown Authors")}</span>
                                {paper.paper_id && (
                                  <span className="font-mono text-[11px] px-1.5 py-0.2 bg-surface-container-highest rounded text-outline">
                                    {paper.paper_id}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category & Tags */}
                        <td className="p-4 font-mono text-xs text-on-surface-variant">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                isReport
                                  ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                  : "bg-surface-container-highest border-primary/20 text-primary"
                              }`}
                            >
                              {paper.venue || paper.primary_category || (isReport ? "Generated Report" : "Academic")}
                            </span>
                            {Array.isArray(paper.tags) &&
                              paper.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 rounded text-[11px] bg-surface-variant text-on-surface-variant"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        </td>

                        {/* File Size & Stored Date */}
                        <td className="p-4 font-mono text-xs text-on-surface-variant">
                          <div className="text-on-surface font-medium">
                            {paper.file_size_label || "Cloud Storage"}
                          </div>
                          <div className="text-[11px] text-outline mt-0.5">
                            {paper.downloaded_at
                              ? new Date(paper.downloaded_at).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )
                              : "Archived"}
                          </div>
                        </td>

                        {/* Type / Year */}
                        <td className="p-4 text-center">
                          {isReport ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30">
                              Report
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-surface-container-highest text-on-surface font-semibold border border-outline-variant/30">
                              {paper.year || "—"}
                            </span>
                          )}
                        </td>

                        {/* Actions (Download PDF, Download DOCX, View Abstract/Summary, Delete) */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Abstract / Summary View */}
                            {paper.summary && (
                              <button
                                onClick={() => setInspectPaper(paper)}
                                className="px-2 py-1 rounded text-xs font-label-md bg-surface-container-high border border-outline-variant/40 hover:border-primary text-on-surface hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                                title={isReport ? "Read Report Abstract" : "Read Paper Abstract"}
                              >
                                <span className="material-symbols-outlined text-sm">
                                  subject
                                </span>
                                <span>{isReport ? "View" : "Abstract"}</span>
                              </button>
                            )}

                            {/* Direct PDF Download / View */}
                            {privatePdfUrl && (
                              <a
                                href={privatePdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`px-2 py-1 rounded text-xs font-label-md border transition-all flex items-center gap-1 cursor-pointer ${
                                  isReport
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-black"
                                    : "bg-primary/10 border-primary/30 text-primary hover:bg-primary hover:text-on-primary"
                                }`}
                                title="Download / Open PDF"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  picture_as_pdf
                                </span>
                                <span>PDF</span>
                              </a>
                            )}

                            {/* Direct DOCX Download for Generated Reports */}
                            {isReport && docxDownloadUrl && (
                              <a
                                href={docxDownloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded text-xs font-label-md bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                                title="Download Word Document (.docx)"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  description
                                </span>
                                <span>DOCX</span>
                              </a>
                            )}

                            {/* Delete single item button */}
                            <button
                              onClick={() => setDeleteTarget(paper)}
                              className="p-1 rounded text-xs bg-error/10 border border-error/20 hover:bg-error/20 text-error transition-colors flex items-center justify-center cursor-pointer"
                              title={
                                isReport
                                  ? "Delete Generated Report and remove from Supabase Storage"
                                  : "Delete Paper, Supabase PDF, and vector embeddings"
                              }
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
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

        {/* Abstract / Quick Reader Modal */}
        {inspectPaper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-2xl bg-surface-container-low border border-primary/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="p-5 border-b border-outline-variant/30 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                      inspectPaper.primary_category === "Generated Report" || inspectPaper.status === "report"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-primary/20 text-primary border-primary/30"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {inspectPaper.primary_category === "Generated Report" || inspectPaper.status === "report"
                        ? "description"
                        : "article"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-primary uppercase tracking-wider font-semibold">
                      {inspectPaper.primary_category === "Generated Report" || inspectPaper.status === "report"
                        ? "AI Generated Synthesis Report"
                        : `Paper Details • ${inspectPaper.year || "Preprint"}`}
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
                    Authors / Creator
                  </div>
                  <div className="text-on-surface font-medium">
                    {inspectPaper.authors || "ResearchPilot System"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">
                      Category
                    </div>
                    <div className="text-on-surface">{inspectPaper.venue || inspectPaper.primary_category || "Academic"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">
                      File Size
                    </div>
                    <div className="text-on-surface font-mono text-xs">
                      {inspectPaper.file_size_label}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">
                    Abstract &amp; Summary
                  </div>
                  <div className="p-4 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 text-on-surface-variant leading-relaxed text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {inspectPaper.summary || "No abstract or summary available for this item."}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-outline-variant/30 bg-surface-container-high/40 flex items-center justify-end gap-3 flex-wrap">
                <button
                  onClick={() => setInspectPaper(null)}
                  className="px-4 py-2 rounded-lg text-xs font-label-md bg-surface-container text-on-surface hover:bg-surface-container-highest cursor-pointer transition-colors"
                >
                  Close
                </button>
                {(() => {
                  const privatePdfUrl = inspectPaper.storage_path
                    ? `/api/projects/${encodeURIComponent(projectId)}/papers/${encodeURIComponent(
                        inspectPaper.paper_id || inspectPaper.id
                      )}/file`
                    : null;
                  const isReport =
                    inspectPaper.primary_category === "Generated Report" || inspectPaper.status === "report";

                  return (
                    <>
                      {isReport && privatePdfUrl && (
                        <a
                          href={`${privatePdfUrl}?format=docx`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-lg text-xs font-label-md bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500 hover:text-white font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">description</span>
                          <span>Download DOCX</span>
                        </a>
                      )}
                      {(inspectPaper.pdf_url || privatePdfUrl) && (
                        <a
                          href={privatePdfUrl || inspectPaper.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-lg text-xs font-label-md bg-primary text-on-primary hover:brightness-110 font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-primary/20"
                        >
                          <span className="material-symbols-outlined text-sm">open_in_new</span>
                          <span>Open PDF</span>
                        </a>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Single Item Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-lg bg-surface-container-low border border-error/40 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-error">
                <div className="w-10 h-10 rounded-xl bg-error/15 flex items-center justify-center border border-error/30">
                  <span className="material-symbols-outlined text-2xl">warning</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface">Confirm Permanent Deletion</h3>
                  <p className="text-xs text-error font-medium">Free up Supabase Storage &amp; clean database</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface-variant flex flex-col gap-2">
                <div>
                  <span className="text-outline uppercase text-[10px] font-semibold tracking-wider">Item:</span>
                  <p className="font-semibold text-on-surface text-sm mt-0.5 line-clamp-2">{deleteTarget.title}</p>
                </div>
                {deleteTarget.primary_category === "Generated Report" || deleteTarget.status === "report" ? (
                  <p className="text-amber-300/90 leading-relaxed">
                    This will permanently delete this Generated Report and remove both its PDF and DOCX files from Supabase Storage.
                  </p>
                ) : (
                  <p className="text-amber-300/90 leading-relaxed">
                    This will permanently remove the manuscript from Supabase Storage and cascade-delete all its extracted text chunks, vector embeddings, and visual figures from your vector knowledge base.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-lg text-xs font-label-md bg-surface-container text-on-surface hover:bg-surface-container-highest cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeleteSingle(deleteTarget)}
                  className="px-4 py-2 rounded-lg text-xs font-label-md bg-error text-white font-bold hover:brightness-110 flex items-center gap-1.5 cursor-pointer shadow-md shadow-error/20 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">delete_forever</span>
                      <span>Delete Item</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-lg bg-surface-container-low border border-error/40 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-error">
                <div className="w-10 h-10 rounded-xl bg-error/15 flex items-center justify-center border border-error/30">
                  <span className="material-symbols-outlined text-2xl">delete_sweep</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface">Delete {selectedPaperIds.length} Selected Items?</h3>
                  <p className="text-xs text-error font-medium">Bulk cloud storage and knowledge cleanup</p>
                </div>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed">
                You are about to delete <strong className="text-on-surface">{selectedPaperIds.length}</strong> items. This action will permanently remove all associated PDF and DOCX files from Supabase Storage and remove all related vector embeddings, extracted text chunks, and analyzed visual diagrams from the database.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2 rounded-lg text-xs font-label-md bg-surface-container text-on-surface hover:bg-surface-container-highest cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteBulk}
                  className="px-4 py-2 rounded-lg text-xs font-label-md bg-error text-white font-bold hover:brightness-110 flex items-center gap-1.5 cursor-pointer shadow-md shadow-error/20 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      <span>Deleting {selectedPaperIds.length} items...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">delete_forever</span>
                      <span>Delete All Selected</span>
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
