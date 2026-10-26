"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AppSidebar from "@/components/common/AppSidebar";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${MONTH_NAMES[month] || parts[1]} ${day}, ${year}`;
}

interface DashboardStats {
  totalProjects: number;
  totalPapers: number;
  totalAnalyzed: number;
  totalBytes: number;
  totalStorageLabel: string;
}

interface ProjectActivityContribution {
  id: string;
  title: string;
  count: number;
  chat: number;
  download: number;
  analyzed: number;
  other: number;
}

interface GlobalActivityDay {
  date: string | null;
  count: number;
  level: number;
  isToday: boolean;
  breakdown: {
    chat: number;
    download: number;
    analyzed: number;
    other: number;
  };
  projects: ProjectActivityContribution[];
}

interface GlobalMonthGroup {
  name: string;
  year: number;
  month: number;
  totalActions: number;
  weeks: GlobalActivityDay[][];
}

interface DashboardActivityData {
  success: boolean;
  range: string;
  months: GlobalMonthGroup[];
  summary: {
    totalActions: number;
    chatInteractions: number;
    papersDownloaded: number;
    papersAnalyzed: number;
    otherActions: number;
    projectsCount: number;
    currentStreak: number;
    longestStreak: number;
  };
}

interface StickyNote {
  id: string;
  user_id?: string;
  title: string;
  description: string;
  category: string;
  color_type: "amber" | "emerald" | "sky" | "purple";
  status: string;
  is_pinned: boolean;
  created_at?: string;
  updated_at?: string;
}

interface RecentProjectActivityItem {
  id: string;
  title: string;
  domain: string;
  description: string;
  color: string;
  papers_count: number;
  last_accessed_at: string;
  last_access_label: string;
  latest_activity: {
    type: string;
    description: string;
    created_at: string;
  } | null;
}

function getProjectColorBar(color?: string) {
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

const PALETTE_CONFIGS: Record<
  "amber" | "emerald" | "sky" | "purple",
  {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    borderColor: string;
    topBarColor: string;
    footerRightColor: string;
    defaultCategory: string;
    defaultStatus: string;
  }
> = {
  amber: {
    badgeBg: "bg-amber-500/20",
    badgeText: "text-amber-300",
    badgeBorder: "border-amber-500/30",
    borderColor: "border-amber-500/40 hover:border-amber-500/60",
    topBarColor: "bg-amber-400",
    footerRightColor: "text-amber-400",
    defaultCategory: "Pending Warning",
    defaultStatus: "High Priority",
  },
  emerald: {
    badgeBg: "bg-emerald-500/20",
    badgeText: "text-emerald-300",
    badgeBorder: "border-emerald-500/30",
    borderColor: "border-emerald-500/40 hover:border-emerald-500/60",
    topBarColor: "bg-emerald-400",
    footerRightColor: "text-emerald-400",
    defaultCategory: "Completed",
    defaultStatus: "Verified",
  },
  sky: {
    badgeBg: "bg-sky-500/20",
    badgeText: "text-sky-300",
    badgeBorder: "border-sky-500/30",
    borderColor: "border-sky-500/40 hover:border-sky-500/60",
    topBarColor: "bg-sky-400",
    footerRightColor: "text-sky-400",
    defaultCategory: "Information",
    defaultStatus: "In Review",
  },
  purple: {
    badgeBg: "bg-purple-500/20",
    badgeText: "text-purple-300",
    badgeBorder: "border-purple-500/30",
    borderColor: "border-purple-500/40 hover:border-purple-500/60",
    topBarColor: "bg-purple-400",
    footerRightColor: "text-purple-300",
    defaultCategory: "Hypothesis / Idea",
    defaultStatus: "Experimental",
  },
};

function formatNoteDate(dateStr?: string, isMounted?: boolean): string {
  if (!dateStr) return "Just now";
  if (!isMounted) return dateStr.slice(0, 10);
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return "Just now";
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "Recent";
  }
}

export default function MinimalDashboard() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // New Note state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newStatus, setNewStatus] = useState("Medium");
  const [selectedPalette, setSelectedPalette] = useState<
    "amber" | "emerald" | "sky" | "purple"
  >("amber");
  const [isPinnedNew, setIsPinnedNew] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Filter state
  const [filterPalette, setFilterPalette] = useState<string>("all");

  // Inline edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const fetchNotes = useCallback(async () => {
    try {
      setLoadingNotes(true);
      const res = await fetch("/api/dashboard/notes");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notes)) {
          setNotes(data.notes);
        }
      }
    } catch (err) {
      console.error("Failed to load sticky notes", err);
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  const handleTogglePin = async (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    if (!target) return;
    const newPinned = !target.is_pinned;

    // Optimistically update state
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, is_pinned: newPinned } : n))
    );

    try {
      const res = await fetch("/api/dashboard/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noteId, is_pinned: newPinned }),
      });
      if (!res.ok) {
        // Revert on error
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, is_pinned: !newPinned } : n))
        );
      }
    } catch (err) {
      console.error("Failed to toggle pin", err);
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, is_pinned: !newPinned } : n))
      );
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const prevNotes = [...notes];
    setNotes((prev) => prev.filter((note) => note.id !== noteId));

    try {
      const res = await fetch(`/api/dashboard/notes?id=${encodeURIComponent(noteId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setNotes(prevNotes);
      }
    } catch (err) {
      console.error("Failed to delete note", err);
      setNotes(prevNotes);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSubmittingNote(true);
      const cfg = PALETTE_CONFIGS[selectedPalette];
      const payload = {
        title: newTitle.trim(),
        description: newDesc.trim() || "No details provided.",
        category: newCategory.trim() || cfg.defaultCategory,
        status: newStatus || "Medium",
        color_type: selectedPalette,
        is_pinned: isPinnedNew,
      };

      const res = await fetch("/api/dashboard/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.note) {
          setNotes((prev) => [data.note, ...prev]);
          setNewTitle("");
          setNewDesc("");
          setNewCategory("");
          setNewStatus("Medium");
          setIsPinnedNew(false);
        }
      }
    } catch (err) {
      console.error("Failed to add note", err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleStartEdit = (note: StickyNote) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditDesc(note.description);
    setEditCategory(note.category);
    let s = note.status || "Medium";
    if (!["High", "Medium", "Low"].includes(s)) {
      if (s.toLowerCase().includes("high")) s = "High";
      else if (s.toLowerCase().includes("low")) s = "Low";
      else s = "Medium";
    }
    setEditStatus(s);
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editTitle.trim()) return;
    const payload = {
      id: noteId,
      title: editTitle.trim(),
      description: editDesc.trim(),
      category: editCategory.trim(),
      status: editStatus.trim(),
    };

    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, ...payload } : n))
    );
    setEditingNoteId(null);

    try {
      await fetch("/api/dashboard/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Failed to save note edit", err);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchNotes();
  }, [fetchNotes]);

  // Global stats across all user projects
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Global activity across all user projects
  const [cadenceRange, setCadenceRange] = useState("last_6_months");
  const [activityData, setActivityData] = useState<DashboardActivityData | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    count: number;
    breakdown: { chat: number; download: number; analyzed: number; other: number };
    projects: ProjectActivityContribution[];
  } | null>(null);
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats(data);
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchActivity = useCallback(async (range: string) => {
    try {
      setLoadingActivity(true);
      const res = await fetch(`/api/dashboard/activity?range=${encodeURIComponent(range)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActivityData(data);
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard activity", err);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchActivity(cadenceRange);
  }, [cadenceRange, fetchActivity]);

  // Recent projects with activity
  const [recentProjects, setRecentProjects] = useState<RecentProjectActivityItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

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
      console.error("Failed to load recent projects", err);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentProjects();
  }, [fetchRecentProjects]);

  const filteredNotes = notes
    .filter((note) => {
      if (filterPalette === "pinned") return note.is_pinned;
      if (["amber", "emerald", "sky", "purple"].includes(filterPalette)) {
        return note.color_type === filterPalette;
      }
      return true;
    })
    .sort((a, b) => {
      // Pinned notes always come first
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      // Multiple pinned or multiple unpinned: sort by created_at DESC (newest first)
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-on-background font-body-md selection:bg-primary/30 antialiased">
      {/* Left Sidebar (Common AppSidebar) */}
      <AppSidebar activeTab="Dashboard" />

      {/* Main Dashboard Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-background flex flex-col">
        {/* Header/TopBar */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-outline-variant/15 px-6 lg:px-8 py-4">
          <div className="max-w-container-max mx-auto w-full flex justify-between items-center">
            <div className="flex flex-col">
              <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
                Research Overview
              </h1>
              <p className="font-body-md text-on-surface-variant text-[14px] mt-0.5">
                Welcome back, Dr. Thorne. Your analysis engine is 98% complete.
              </p>
            </div>
          </div>
        </header>

        {/* Scrollable Canvas Body */}
        <div className="p-6 lg:p-8 max-w-container-max mx-auto w-full flex flex-col gap-6 pb-16">
          {/* System Resource Monitor */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-sm">
            <div className="bg-surface-container-low border border-outline-variant/20 px-md py-sm rounded-xl">
              <div className="font-code-sm text-on-surface-variant uppercase text-[10px] tracking-widest mb-1">
                Active Projects
              </div>
              <div className="font-label-md text-[16px] text-primary font-semibold">
                {loadingStats ? (
                  <span className="opacity-50 text-[14px]">Loading...</span>
                ) : (
                  `${stats?.totalProjects ?? 0} Running`
                )}
              </div>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/20 px-md py-sm rounded-xl">
              <div className="font-code-sm text-on-surface-variant uppercase text-[10px] tracking-widest mb-1">
                Papers Downloaded
              </div>
              <div className="font-label-md text-[16px] text-tertiary font-semibold">
                {loadingStats ? (
                  <span className="opacity-50 text-[14px]">Loading...</span>
                ) : (
                  `${stats?.totalPapers ?? 0} Downloaded`
                )}
              </div>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/20 px-md py-sm rounded-xl">
              <div className="font-code-sm text-on-surface-variant uppercase text-[10px] tracking-widest mb-1">
                Storage Occupied
              </div>
              <div className="font-label-md text-[16px] text-on-surface font-semibold">
                {loadingStats ? (
                  <span className="opacity-50 text-[14px]">Loading...</span>
                ) : (
                  stats?.totalStorageLabel ?? "0 MB"
                )}
              </div>
            </div>
          </div>

          {/* Continuity Sticky Notes & Session Memory */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-lg relative overflow-hidden backdrop-blur-md transition-all shadow-lg">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-tertiary to-primary-container"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg pb-sm border-b border-outline-variant/20">
              <div className="flex items-center gap-sm">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    sticky_note_2
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-sm flex-wrap">
                    <h3 className="font-headline-md text-[18px] text-on-surface font-bold">
                      Continuity Sticky Notes &amp; Session Memory
                    </h3>
                    <span className="px-sm py-0.5 rounded-full text-[10px] font-code-sm bg-primary/20 text-primary border border-primary/40 uppercase tracking-wider font-semibold">
                      {notes.filter((n) => n.is_pinned).length} Pinned
                    </span>
                    <span className="px-sm py-0.5 rounded-full text-[10px] font-code-sm bg-tertiary/20 text-tertiary border border-tertiary/40 uppercase tracking-wider font-semibold">
                      {notes.length} Total
                    </span>
                  </div>
                  <p className="font-code-sm text-[11px] text-on-surface-variant mt-0.5">
                    Quick handovers, last session status, and critical project checkpoint reminders
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-xs">
                {/* Filter dropdown */}
                <select
                  value={filterPalette}
                  onChange={(e) => setFilterPalette(e.target.value)}
                  className="px-sm py-1 rounded-lg bg-surface-container-high border border-outline-variant/30 hover:bg-surface-variant text-on-surface font-label-md text-[12px] outline-none cursor-pointer"
                >
                  <option value="all">All Notes</option>
                  <option value="pinned">Pinned Only</option>
                  <option value="amber">Amber (Warning)</option>
                  <option value="emerald">Emerald (Completed)</option>
                  <option value="sky">Sky (Info)</option>
                  <option value="purple">Purple (Idea)</option>
                </select>

                {/* Quick Pin Board filter toggle */}
                <button
                  type="button"
                  onClick={() =>
                    setFilterPalette((prev) => (prev === "pinned" ? "all" : "pinned"))
                  }
                  className={`px-sm py-1 rounded-lg border font-label-md text-[12px] flex items-center gap-xs transition-colors cursor-pointer ${
                    filterPalette === "pinned"
                      ? "bg-primary text-on-primary border-primary shadow-sm"
                      : "bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25"
                  }`}
                  title={filterPalette === "pinned" ? "Show all notes" : "Filter to pinned notes"}
                >
                  <span
                    className="material-symbols-outlined text-[15px]"
                    style={{ fontVariationSettings: filterPalette === "pinned" ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    push_pin
                  </span>
                  <span>{filterPalette === "pinned" ? "Showing Pinned" : "Pin Board"}</span>
                </button>
              </div>
            </div>

            {/* Notes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
              {loadingNotes ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={`skeleton-${idx}`}
                    className="rounded-xl p-md h-[180px] bg-surface-container-highest/20 border border-outline-variant/20 animate-pulse"
                  />
                ))
              ) : filteredNotes.length === 0 ? (
                <div className="col-span-full py-10 px-4 flex flex-col items-center justify-center text-center bg-surface-container/20 rounded-xl border border-dashed border-outline-variant/30">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                    <span className="material-symbols-outlined text-2xl">
                      sticky_note_2
                    </span>
                  </div>
                  <p className="text-sm font-label-md text-on-surface font-semibold">
                    {filterPalette === "pinned" ? "No pinned notes" : "No sticky notes created yet"}
                  </p>
                  <p className="text-xs font-code-sm text-outline mt-1 max-w-md">
                    {filterPalette === "pinned"
                      ? "Click the pin icon on any note to pin it to the top of your board."
                      : "Add a short note or last status reminder below so you can easily remember where you left off when you return."}
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const cfg =
                    PALETTE_CONFIGS[note.color_type as "amber" | "emerald" | "sky" | "purple"] ||
                    PALETTE_CONFIGS.amber;
                  const isEditing = editingNoteId === note.id;

                  return (
                    <div
                      key={note.id}
                      className={`rounded-xl p-md flex flex-col justify-between transition-all relative group bg-surface-container-highest/30 border ${
                        cfg.borderColor
                      } ${
                        note.is_pinned
                          ? "ring-1 ring-primary/40 shadow-sm"
                          : ""
                      }`}
                    >
                      <div
                        className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${cfg.topBarColor}`}
                      ></div>

                      {isEditing ? (
                        /* Inline Edit Form */
                        <div className="space-y-xs pt-1">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Title..."
                            className="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface font-label-md text-[13px] px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={3}
                            placeholder="Description..."
                            className="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface font-body-md text-[11px] px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                          />
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              placeholder="Category..."
                              className="w-1/2 bg-surface-container-high border border-outline-variant/30 text-on-surface font-code-sm text-[10px] px-1.5 py-0.5 rounded focus:outline-none"
                            />
                            <select
                              value={["High", "Medium", "Low"].includes(editStatus) ? editStatus : "Medium"}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="w-1/2 bg-surface-container-high border border-outline-variant/30 text-on-surface font-code-sm text-[10px] px-1.5 py-0.5 rounded focus:outline-none cursor-pointer"
                            >
                              <option value="High" className="bg-surface-container-high text-on-surface">High</option>
                              <option value="Medium" className="bg-surface-container-high text-on-surface">Medium</option>
                              <option value="Low" className="bg-surface-container-high text-on-surface">Low</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-end gap-1 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="px-2 py-0.5 text-[11px] font-label-md rounded bg-surface-container-high text-on-surface hover:bg-surface-variant cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(note.id)}
                              className="px-2 py-0.5 text-[11px] font-label-md rounded bg-primary text-on-primary font-semibold hover:bg-primary-fixed cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard Note View */
                        <>
                          <div className="space-y-xs pt-1">
                            <div className="flex items-center justify-between">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-code-sm font-bold uppercase tracking-wider ${cfg.badgeBg} ${cfg.badgeText} border ${cfg.badgeBorder}`}
                              >
                                {note.category || cfg.defaultCategory}
                              </span>
                              <div className="flex items-center gap-1 text-on-surface-variant group-hover:text-on-surface">
                                {/* Pin Toggle Button */}
                                <button
                                  type="button"
                                  onClick={() => handleTogglePin(note.id)}
                                  className={`p-1 rounded transition-all hover:scale-110 cursor-pointer ${
                                    note.is_pinned
                                      ? "text-primary bg-primary/20"
                                      : "hover:text-primary opacity-60 hover:opacity-100"
                                  }`}
                                  title={note.is_pinned ? "Unpin note" : "Pin note to top"}
                                >
                                  <span
                                    className="material-symbols-outlined text-[16px]"
                                    style={{
                                      fontVariationSettings: note.is_pinned
                                        ? "'FILL' 1"
                                        : "'FILL' 0",
                                    }}
                                  >
                                    push_pin
                                  </span>
                                </button>
                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(note)}
                                  className="p-1 rounded transition-all hover:scale-110 cursor-pointer hover:text-primary opacity-60 hover:opacity-100"
                                  title="Edit note"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    edit
                                  </span>
                                </button>
                                {/* Dismiss / Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="p-1 rounded transition-all hover:scale-110 cursor-pointer hover:text-error opacity-60 hover:opacity-100"
                                  title="Delete note"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    close
                                  </span>
                                </button>
                              </div>
                            </div>
                            <h4 className="font-label-md text-[14px] font-semibold text-on-surface pt-1 flex items-center gap-1.5">
                              {note.is_pinned && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-primary/25 text-primary font-code-sm uppercase font-bold tracking-wider">
                                  PINNED
                                </span>
                              )}
                              <span>{note.title}</span>
                            </h4>
                            <p className="font-body-md text-[12px] text-on-surface-variant leading-relaxed">
                              {note.description}
                            </p>
                          </div>
                          <div className="mt-md pt-xs border-t border-outline-variant/10 flex items-center justify-between font-code-sm text-[10px] text-on-surface-variant">
                            <span>{formatNoteDate(note.created_at, isMounted)}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                                (note.status || "").toLowerCase().includes("high")
                                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                  : (note.status || "").toLowerCase().includes("low")
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {note.status || "Medium"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Note Creator Bar */}
            <form
              onSubmit={handleAddNote}
              className="bg-surface-container-highest/20 border border-outline-variant/20 rounded-xl p-md flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-md"
            >
              <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-sm">
                <div className="flex items-center gap-xs font-label-md text-[13px] text-primary flex-shrink-0">
                  <span className="material-symbols-outlined text-[18px]">
                    note_add
                  </span>
                  <span className="font-medium">+ New Sticky Note:</span>
                </div>
                <input
                  type="text"
                  placeholder="Note title / Checkpoint reminder (e.g. Urgent: Check tensor cache)..."
                  className="bg-surface-container-high border border-outline-variant/30 text-on-surface font-body-md text-[13px] px-sm py-1.5 rounded-lg flex-1 focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/50"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Short reminder description / status details..."
                  className="bg-surface-container-high border border-outline-variant/30 text-on-surface font-body-md text-[13px] px-sm py-1.5 rounded-lg flex-1 focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/50"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
                <div className="relative w-full md:w-36">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface font-body-md text-[12px] px-sm py-1.5 rounded-lg focus:ring-1 focus:ring-primary focus:outline-none appearance-none cursor-pointer pr-7"
                    title="Select priority status"
                  >
                    <option value="High" className="bg-surface-container-high text-on-surface">
                      High
                    </option>
                    <option value="Medium" className="bg-surface-container-high text-on-surface">
                      Medium
                    </option>
                    <option value="Low" className="bg-surface-container-high text-on-surface">
                      Low
                    </option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-sm flex-shrink-0">
                {/* Pin Immediately Toggle */}
                <button
                  type="button"
                  onClick={() => setIsPinnedNew((prev) => !prev)}
                  className={`p-1.5 rounded-lg border font-label-md text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                    isPinnedNew
                      ? "bg-primary/20 text-primary border-primary/50 shadow-sm"
                      : "bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:text-on-surface"
                  }`}
                  title={isPinnedNew ? "Will be created as pinned" : "Click to pin immediately"}
                >
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: isPinnedNew ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    push_pin
                  </span>
                  <span className="hidden sm:inline">{isPinnedNew ? "Pinned" : "Pin"}</span>
                </button>

                {/* Color Palette Selector */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-container-high/60 rounded-lg border border-outline-variant/20">
                  <span className="font-code-sm text-[10px] text-on-surface-variant mr-1">
                    Palette:
                  </span>
                  <button
                    type="button"
                    title="Amber / Warning"
                    onClick={() => setSelectedPalette("amber")}
                    className={`w-4 h-4 rounded-full bg-amber-400 transition-transform hover:scale-110 cursor-pointer ${
                      selectedPalette === "amber"
                        ? "ring-2 ring-amber-300 ring-offset-1 ring-offset-surface-dim scale-110"
                        : "opacity-60"
                    }`}
                  ></button>
                  <button
                    type="button"
                    title="Emerald / Success"
                    onClick={() => setSelectedPalette("emerald")}
                    className={`w-4 h-4 rounded-full bg-emerald-400 transition-transform hover:scale-110 cursor-pointer ${
                      selectedPalette === "emerald"
                        ? "ring-2 ring-emerald-300 ring-offset-1 ring-offset-surface-dim scale-110"
                        : "opacity-60"
                    }`}
                  ></button>
                  <button
                    type="button"
                    title="Sky / Info"
                    onClick={() => setSelectedPalette("sky")}
                    className={`w-4 h-4 rounded-full bg-sky-400 transition-transform hover:scale-110 cursor-pointer ${
                      selectedPalette === "sky"
                        ? "ring-2 ring-sky-300 ring-offset-1 ring-offset-surface-dim scale-110"
                        : "opacity-60"
                    }`}
                  ></button>
                  <button
                    type="button"
                    title="Purple / Idea"
                    onClick={() => setSelectedPalette("purple")}
                    className={`w-4 h-4 rounded-full bg-purple-400 transition-transform hover:scale-110 cursor-pointer ${
                      selectedPalette === "purple"
                        ? "ring-2 ring-purple-300 ring-offset-1 ring-offset-surface-dim scale-110"
                        : "opacity-60"
                    }`}
                  ></button>
                </div>

                {/* Add Note Button */}
                <button
                  type="submit"
                  disabled={isSubmittingNote}
                  className="px-md py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-[12px] font-semibold flex items-center gap-xs transition-colors hover:bg-primary-fixed cursor-pointer disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isSubmittingNote ? "sync" : "save"}
                  </span>
                  <span>{isSubmittingNote ? "Adding..." : "Add Note"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Research Activity Heatmap across all projects */}
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-lg flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-outline-variant/20">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-md text-headline-md text-on-surface">
                    Research Activity
                  </h3>
                  <span className="font-label-md text-code-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                    All Projects Workspace Map
                  </span>
                </div>
                <p className="font-body-md text-[13px] text-on-surface-variant mt-1">
                  Daily research actions across all active projects (chat queries, paper downloads, analyses &amp; pipeline jobs)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label-md text-code-sm text-on-surface-variant">Cadence Range:</span>
                <select
                  value={cadenceRange}
                  onChange={(e) => setCadenceRange(e.target.value)}
                  className="bg-surface-container border border-outline-variant/40 rounded-lg text-xs font-label-md text-on-surface px-3 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                >
                  <option value="last_6_months">Last 6 Months</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="year_to_date">Year to Date {currentYear ? `(${currentYear})` : ""}</option>
                  <option value="all_time">All-Time Workspace History</option>
                </select>
              </div>
            </div>

            {/* Heatmap Matrix: Full width responsive grid with distinct month cards and gaps */}
            <div className="w-full">
              {activityData?.months && activityData.months.length > 0 ? (
                <div
                  className={`w-full grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5 ${
                    loadingActivity ? "opacity-70 transition-opacity" : ""
                  }`}
                >
                  {activityData.months.map((m) => (
                    <div
                      key={`${m.year}-${m.month}`}
                      className="bg-surface-container/30 border border-outline-variant/25 rounded-xl p-3 flex flex-col justify-between hover:border-primary/30 transition-all hover:shadow-md min-w-0"
                    >
                      {/* Month Header with action badge */}
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-outline-variant/15">
                        <span className="text-xs font-semibold text-on-surface tracking-wide">
                          {m.name} <span className="text-[10px] font-normal text-on-surface-variant">{m.year}</span>
                        </span>
                        {m.totalActions > 0 ? (
                          <span className="text-[10px] font-label-md px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                            {m.totalActions} acts
                          </span>
                        ) : (
                          <span className="text-[10px] font-label-md text-on-surface-variant/60">0</span>
                        )}
                      </div>

                      {/* Week Columns of 7 Rows within this month */}
                      <div className="flex justify-between gap-1 w-full flex-1 items-center py-0.5">
                        {m.weeks.map((week, wIdx) => (
                          <div key={wIdx} className="flex flex-col justify-between gap-1 flex-1">
                            {week.map((day, dIdx) => {
                              if (!day.date) {
                                return (
                                  <div
                                    key={`pad-${dIdx}`}
                                    className="w-full aspect-square rounded-sm opacity-0 pointer-events-none"
                                  />
                                );
                              }
                              const levelClasses = [
                                "bg-surface-container-high/60 border border-outline-variant/10",
                                "bg-primary/25 border border-primary/30",
                                "bg-primary/50 border border-primary/50",
                                "bg-primary/75 border border-primary/70",
                                "bg-primary shadow-sm shadow-primary/30",
                              ];
                              const projectBreakdownText = (day.projects || [])
                                .map(
                                  (p) =>
                                    `• ${p.title}: ${p.count} actions (${[
                                      p.chat ? `${p.chat} chat` : "",
                                      p.download ? `${p.download} dl` : "",
                                      p.analyzed ? `${p.analyzed} analyzed` : "",
                                      p.other ? `${p.other} other` : "",
                                    ]
                                      .filter(Boolean)
                                      .join(", ")})`
                                )
                                .join("\n");

                              const tooltipTitle =
                                day.count > 0
                                  ? `${formatDateLabel(day.date)}: ${day.count} total actions\nProjects:\n${projectBreakdownText}`
                                  : `${formatDateLabel(day.date)}: No research activity`;

                              return (
                                <div
                                  key={day.date}
                                  onMouseEnter={() =>
                                    setHoveredDay({
                                      date: day.date!,
                                      count: day.count,
                                      breakdown: day.breakdown,
                                      projects: day.projects || [],
                                    })
                                  }
                                  onMouseLeave={() => setHoveredDay(null)}
                                  className={`w-full aspect-square rounded-sm ${
                                    levelClasses[day.level] || levelClasses[0]
                                  } ${
                                    day.isToday
                                      ? "ring-2 ring-primary-fixed ring-offset-1 ring-offset-surface-container-low"
                                      : ""
                                  } transition-transform hover:scale-125 cursor-pointer relative`}
                                  title={tooltipTitle}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-container/20 border border-outline-variant/20 rounded-xl p-3 h-[130px] animate-pulse"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Live Hover Info bar showing which project(s) contributed to that day */}
            {hoveredDay && (
              <div className="mt-3 text-xs font-label-md text-on-surface-variant flex flex-col md:flex-row md:items-center justify-between gap-2 bg-surface-container px-3.5 py-2.5 rounded-xl border border-outline-variant/30 animate-fadeIn">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="material-symbols-outlined text-sm text-primary">event_available</span>
                  <span className="font-semibold text-on-surface">
                    {formatDateLabel(hoveredDay.date)}
                  </span>
                  <span className="text-outline">•</span>
                  <span>
                    {hoveredDay.count > 0 ? (
                      <span className="text-primary font-medium">
                        {hoveredDay.count} total {hoveredDay.count === 1 ? "action" : "actions"} across {hoveredDay.projects.length} {hoveredDay.projects.length === 1 ? "project" : "projects"}
                      </span>
                    ) : (
                      <span className="text-outline">No research activity recorded on this day</span>
                    )}
                  </span>
                </div>
                {hoveredDay.projects && hoveredDay.projects.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {hoveredDay.projects.map((proj) => (
                      <div
                        key={proj.id}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-container-high border border-outline-variant/30 text-[11px]"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        <span className="font-medium text-on-surface">{proj.title}:</span>
                        <span className="text-primary font-semibold">{proj.count}</span>
                        <span className="text-outline text-[10px]">
                          ({[
                            proj.chat ? `${proj.chat} chat` : "",
                            proj.download ? `${proj.download} dl` : "",
                            proj.analyzed ? `${proj.analyzed} anlz` : "",
                            proj.other ? `${proj.other} jobs` : ""
                          ].filter(Boolean).join(", ")})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Heatmap Footer with Legend & Breakdown */}
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-label-md">
                <span className="text-on-surface font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  {activityData?.summary?.totalActions ?? 0} Total Actions
                </span>
                <span className="text-outline">•</span>
                <span className="text-on-surface-variant">
                  {activityData?.summary?.chatInteractions ?? 0} Chat Queries
                </span>
                <span className="text-outline">•</span>
                <span className="text-on-surface-variant">
                  {activityData?.summary?.papersDownloaded ?? 0} Downloaded
                </span>
                <span className="text-outline">•</span>
                <span className="text-on-surface-variant">
                  {activityData?.summary?.papersAnalyzed ?? 0} Analyzed
                </span>
                {activityData?.summary?.otherActions ? (
                  <>
                    <span className="text-outline">•</span>
                    <span className="text-on-surface-variant">
                      {activityData.summary.otherActions} Pipeline Runs &amp; Searches
                    </span>
                  </>
                ) : null}
                <span className="text-outline">•</span>
                <span className="text-emerald-400 font-medium">
                  Current Streak: {activityData?.summary?.currentStreak ?? 0} {activityData?.summary?.currentStreak === 1 ? "Day" : "Days"}
                </span>
                <span className="text-outline">•</span>
                <span className="text-outline">
                  Longest Streak: {activityData?.summary?.longestStreak ?? 0} {activityData?.summary?.longestStreak === 1 ? "Day" : "Days"}
                </span>
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center gap-2 text-xs font-label-md text-on-surface-variant">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-surface-container-high border border-outline-variant/10" title="0 actions"></div>
                <div className="w-3 h-3 rounded-sm bg-primary/25 border border-primary/30" title="1-2 actions"></div>
                <div className="w-3 h-3 rounded-sm bg-primary/50 border border-primary/50" title="3-5 actions"></div>
                <div className="w-3 h-3 rounded-sm bg-primary/75 border border-primary/70" title="6-9 actions"></div>
                <div className="w-3 h-3 rounded-sm bg-primary shadow-sm shadow-primary/30" title="10+ actions"></div>
                <span>More</span>
              </div>
            </div>
          </div>

          {/* Recent Project Activity */}
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-lg">
            <div className="flex justify-between items-center mb-lg">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Recent Project Activity
              </h3>
              <Link
                href="/projects"
                className="text-xs font-label-md text-primary hover:underline flex items-center gap-1 group"
              >
                <span>View All Projects</span>
                <span className="material-symbols-outlined text-[14px] group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              </Link>
            </div>
            <div className="space-y-sm">
              {loadingRecent ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={`skeleton-recent-${idx}`}
                    className="p-md bg-surface-container-highest/20 border border-outline-variant/10 rounded-xl h-20 animate-pulse"
                  />
                ))
              ) : recentProjects.length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant font-code-sm text-xs bg-surface-container-highest/10 rounded-xl border border-dashed border-outline-variant/20">
                  No recent projects found.
                </div>
              ) : (
                recentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="group flex items-center justify-between p-md bg-surface-container-highest/30 border border-outline-variant/10 hover:border-outline-variant/30 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-md min-w-0">
                      <div
                        className={`w-2 h-10 ${getProjectColorBar(
                          project.color
                        )} rounded-full shrink-0`}
                      ></div>
                      <div className="min-w-0">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-label-md text-[15px] text-on-surface hover:text-primary transition-colors truncate block"
                          title={project.title}
                        >
                          {project.title}
                        </Link>
                        <div className="font-body-md text-on-surface-variant text-[13px] mt-0.5 truncate">
                          {project.latest_activity?.description ||
                            `${project.domain} • Workspace active`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-lg shrink-0">
                      <div className="font-code-sm text-[12px] text-on-surface-variant text-right">
                        <div>Last access</div>
                        <div className="text-on-surface mt-0.5">{project.last_access_label}</div>
                      </div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                        title={`Open ${project.title}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          chevron_right
                        </span>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {/*
        <footer className="w-full py-xl border-t border-outline-variant/20 bg-surface-container-lowest mt-auto">
          <div className="flex justify-between items-center px-xl max-w-7xl mx-auto">
            <div className="font-label-md text-on-surface-variant text-[12px]">
              © 2024 SupervisorX AI Research. All rights reserved.
            </div>
            <div className="flex gap-lg">
              <a
                className="font-label-md text-[12px] text-on-surface-variant hover:text-primary transition-colors"
                href="#"
              >
                Documentation
              </a>
              <a
                className="font-label-md text-[12px] text-on-surface-variant hover:text-primary transition-colors"
                href="#"
              >
                API Reference
              </a>
            </div>
          </div>
        </footer> */}
      </main>
    </div>
  );
}
