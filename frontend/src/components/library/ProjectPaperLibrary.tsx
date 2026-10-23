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
}

interface ProjectPaperLibraryProps {
  projectId: string;
}

export default function ProjectPaperLibrary({ projectId }: ProjectPaperLibraryProps) {
  const [papers, setPapers] = useState<LibraryPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [sortOption, setSortOption] = useState<
    "az" | "za" | "newest" | "oldest" | "year_desc" | "year_asc" | "size"
  >("az");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [inspectPaper, setInspectPaper] = useState<LibraryPaper | null>(null);
  const [projectName, setProjectName] = useState<string>("");

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

  // Handle client-side search filtering if API debounce is not needed
  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return papers;
    const q = searchQuery.toLowerCase();
    return papers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.venue.toLowerCase().includes(q) ||
        p.paper_id.toLowerCase().includes(q) ||
        (p.summary && p.summary.toLowerCase().includes(q))
    );
  }, [papers, searchQuery]);

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
                Project Library
              </span>
            </div>
            <h1 className="font-headline-lg text-2xl md:text-3xl font-bold tracking-tight text-on-surface">
              Paper Library
            </h1>
            <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
              Archived research literature downloaded for{" "}
              <span className="text-primary font-medium">
                {projectName || projectId}
              </span>
              . Search, sort, and open any stored manuscript.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <div className="glass-panel px-3.5 py-2 rounded-lg flex items-center gap-2 text-xs border border-outline-variant/30 bg-surface-container-low">
              <span className="material-symbols-outlined text-primary text-base">
                description
              </span>
              <span className="text-on-surface-variant">Downloaded Papers:</span>
              <span className="font-bold text-on-surface font-mono">{totalCount}</span>
            </div>
            <div className="glass-panel px-3.5 py-2 rounded-lg flex items-center gap-2 text-xs border border-outline-variant/30 bg-surface-container-low">
              <span className="material-symbols-outlined text-secondary text-base">
                inventory_2
              </span>
              <span className="text-on-surface-variant">Storage Occupied:</span>
              <span className="font-bold text-emerald-400 font-mono">
                {totalStorageLabel}
              </span>
            </div>
            <Link
              href={`/projects/${projectId}/chatbot`}
              className="px-3.5 py-2 bg-primary text-on-primary hover:brightness-110 rounded-lg text-xs font-label-md font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">smart_toy</span>
              <span>Find More Papers</span>
            </Link>
          </div>
        </div>

        {/* Toolbar: Search, Year Filter, Sorting */}
        <div className="glass-panel p-4 rounded-xl flex flex-col xl:flex-row xl:items-center justify-between gap-4 border border-outline-variant/30 ink-shadow bg-surface-container-low">
          {/* Left: Checkbox Select All & Selection Count */}
          <div className="flex items-center gap-3">
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
              <span className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-container-highest text-primary font-medium border border-outline-variant/30">
                {selectedPaperIds.length} selected
              </span>
            )}
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
            {(searchQuery || yearFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
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

        {/* Papers Table */}
        <div className="glass-panel rounded-xl border border-outline-variant/30 overflow-hidden ink-shadow bg-surface-container-low">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-low font-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4 min-w-[340px]">
                    Research Paper Title &amp; Publication
                  </th>
                  <th className="p-4 min-w-[160px]">Venue &amp; Tags</th>
                  <th className="p-4 min-w-[140px]">Size &amp; Downloaded</th>
                  <th className="p-4 text-center w-28">Year</th>
                  <th className="p-4 text-right w-36">Action</th>
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
                        <span>Loading project paper library...</span>
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
                          No papers found
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {searchQuery || yearFilter !== "all"
                            ? "No downloaded papers matched your search or year filters. Try adjusting your search term."
                            : "No papers have been downloaded for this project yet. Use the Find Papers AI Chatbot to scan arXiv and download relevant literature."}
                        </p>
                        <div className="flex items-center gap-3 pt-2">
                          {(searchQuery || yearFilter !== "all") && (
                            <button
                              onClick={() => {
                                setSearchQuery("");
                                setYearFilter("all");
                              }}
                              className="px-4 py-1.5 bg-surface-container-high border border-outline-variant/40 rounded-lg text-xs font-label-md hover:bg-surface-container cursor-pointer"
                            >
                              Reset Filters
                            </button>
                          )}
                          <Link
                            href={`/projects/${projectId}/chatbot`}
                            className="px-4 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-label-md font-semibold hover:brightness-110 cursor-pointer"
                          >
                            Open Find Papers Chatbot
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPapers.map((paper) => {
                    const isChecked = selectedPaperIds.includes(paper.id);
                    const openUrl = paper.entry_url || paper.pdf_url;
                    const privatePdfUrl = paper.storage_path
                      ? `/api/projects/${encodeURIComponent(projectId)}/papers/${encodeURIComponent(paper.paper_id)}/file`
                      : null;
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

                        {/* Title & Publication Details */}
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

                        {/* Venue & Tags */}
                        <td className="p-4 font-mono text-xs text-on-surface-variant">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[11px] bg-surface-container-highest border border-primary/20 text-primary font-medium">
                              {paper.venue || "Academic Publication"}
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

                        {/* File Size & Downloaded Time */}
                        <td className="p-4 font-mono text-xs text-on-surface-variant">
                          <div className="text-on-surface font-medium">
                            {paper.file_size_label || "PDF Document"}
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

                        {/* Year */}
                        <td className="p-4 text-center">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-surface-container-highest text-on-surface font-semibold border border-outline-variant/30">
                            {paper.year || "—"}
                          </span>
                        </td>

                        {/* Actions (Direct View/Abstract inspection) */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {paper.summary && (
                              <button
                                onClick={() => setInspectPaper(paper)}
                                className="px-2.5 py-1.5 rounded text-xs font-label-md bg-surface-container-high border border-outline-variant/40 hover:border-primary text-on-surface hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                                title="Read Abstract / Summary"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  subject
                                </span>
                                <span>Abstract</span>
                              </button>
                            )}
                            {privatePdfUrl && (
                              <a
                                href={privatePdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded text-xs font-label-md bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-on-primary transition-all flex items-center gap-1 cursor-pointer"
                                title="Download stored PDF"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  open_in_new
                                </span>
                                <span>Open</span>
                              </a>
                            )}
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

        {/* Abstract Modal / Quick Reader Drawer */}
        {inspectPaper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-2xl bg-surface-container-low border border-primary/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="p-5 border-b border-outline-variant/30 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">article</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-primary uppercase tracking-wider font-semibold">
                      Paper Details • {inspectPaper.year || "Preprint"}
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
                      Venue
                    </div>
                    <div className="text-on-surface">{inspectPaper.venue || "Academic"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">
                      File Archive
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
                  <div className="p-4 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 text-on-surface-variant leading-relaxed text-sm">
                    {inspectPaper.summary || "No abstract available for this paper."}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-outline-variant/30 bg-surface-container-high/40 flex items-center justify-end gap-3">
                <button
                  onClick={() => setInspectPaper(null)}
                  className="px-4 py-2 rounded-lg text-xs font-label-md bg-surface-container text-on-surface hover:bg-surface-container-highest cursor-pointer transition-colors"
                >
                  Close
                </button>
                {(inspectPaper.entry_url || inspectPaper.pdf_url) && (
                  <a
                    href={inspectPaper.entry_url || inspectPaper.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg text-xs font-label-md bg-primary text-on-primary hover:brightness-110 font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-primary/20"
                  >
                    <span className="material-symbols-outlined text-sm">
                      open_in_new
                    </span>
                    <span>Open Paper Link</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
