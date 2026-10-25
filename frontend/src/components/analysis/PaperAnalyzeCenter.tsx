"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ProjectSidebar from "@/components/common/ProjectSidebar";

export interface Paper {
  id: string;
  paper_id?: string;
  title: string;
  authors: string;
  venue: string;
  tags: string[];
  size: number; // in MB
  sizeLabel: string;
  timeAgo: string;
  date: string;
  citations: number;
  status: "analyzed" | "pending";
  analyzed_at?: string;
  insights?: {
    title?: string;
    abstract_synthesis?: string;
    methodology?: string;
    key_contributions?: string[];
    visual_highlights?: string;
    status?: string;
  };
  chunks_count?: number;
  figures_count?: number;
  vectors_count?: number;
}

interface UploadTransfer {
  id: string;
  name: string;
  sizeLabel: string;
  type: string;
  progress: number;
  status: "active" | "paused" | "completed";
  subtext?: string;
  warning?: string;
}

const INITIAL_UPLOADS: UploadTransfer[] = [];

function getRelativeTime(dateStr?: string): string {
  if (!dateStr) return "Just now";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// Pipeline Stages Configuration
const PIPELINE_STEPS = [
  { id: "load", label: "PDF Cloud Load", desc: "Retrieve PDF from Supabase Storage" },
  { id: "text", label: "Structure & Chunks", desc: "PyMuPDF section & text extraction" },
  { id: "vlm", label: "Multimodal Visual AI", desc: "Nemotron VLM figures & diagrams" },
  { id: "vector", label: "pgvector Indexing", desc: "2048-D embeddings & database write" },
];

function getActiveStepIndex(stage: string): number {
  switch (stage) {
    case "validating":
      return 0;
    case "extracting_text":
    case "extracting_figures":
      return 1;
    case "analyzing_figures":
      return 2;
    case "generating_embeddings":
    case "saving_vectors":
    case "finalizing":
      return 3;
    case "completed":
      return 4;
    default:
      return 0;
  }
}

const STAGE_LABELS: Record<string, string> = {
  validating: "Downloading preprint from Supabase Storage",
  extracting_text: "Extracting document structure & section-aware chunks",
  extracting_figures: "Detecting figures, charts, diagrams & image tables",
  analyzing_figures: "Analyzing visual diagrams with Nemotron Vision VLM",
  generating_embeddings: "Generating 2048-D dense embeddings via Nemotron",
  saving_vectors: "Persisting chunks and vectors in Supabase pgvector",
  finalizing: "Synthesizing research claims & citation cross-references",
  completed: "Analysis Complete & pgvector Synchronized",
};

export default function PaperAnalyzeCenter({
  projectId = "cognitive-mapper",
}: {
  projectId?: string;
}) {
  const [activeTab, setActiveTab] = useState<"upload" | "analyze">("analyze");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [uploads, setUploads] = useState<UploadTransfer[]>(INITIAL_UPLOADS);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "analyzed" | "pending">("all");
  const [sortOption, setSortOption] = useState<"newest" | "az" | "za" | "size">("newest");

  // Staged Upload State
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customAuthors, setCustomAuthors] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccessInfo, setUploadSuccessInfo] = useState<{
    id: string;
    title: string;
    filename: string;
    sizeLabel: string;
  } | null>(null);

  // Dynamic AI Progress Engine State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [analyzingPaperId, setAnalyzingPaperId] = useState<string | null>(null);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [progressLevel, setProgressLevel] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStage, setCurrentStage] = useState("validating");
  const [activePaperTitle, setActivePaperTitle] = useState("");
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(1);
  const [jobCompleted, setJobCompleted] = useState(false);

  // Selected paper insights modal
  const [insightsPaper, setInsightsPaper] = useState<Paper | null>(null);

  // Drag and Drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Papers from PostgreSQL via API
  const fetchPapers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/papers`);
      if (!res.ok) throw new Error("Failed to load papers");
      const data = await res.json();
      if (data.success && Array.isArray(data.papers)) {
        const mapped: Paper[] = data.papers.map((p: any) => {
          const fileSizeMB = (Number(p.file_size) || 0) / (1024 * 1024);
          return {
            id: p.paper_id || p.id,
            paper_id: p.paper_id,
            title: p.title || "Untitled Paper",
            authors: p.authors || "Unknown Authors",
            venue: p.venue || p.primary_category || "Academic Preprint",
            tags: Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : ["Deep Learning", "Preprint"],
            size: Number(fileSizeMB.toFixed(2)),
            sizeLabel: p.file_size_label || `${fileSizeMB.toFixed(1)} MB • PDF`,
            timeAgo: getRelativeTime(p.downloaded_at),
            date: p.downloaded_at ? p.downloaded_at.slice(0, 10) : "",
            citations: Math.floor(Math.random() * 500) + 12,
            status: p.status === "analyzed" ? "analyzed" : "pending",
            analyzed_at: p.analyzed_at,
            insights: p.insights,
            chunks_count: p.chunks_count || 0,
            figures_count: p.figures_count || 0,
            vectors_count: p.vectors_count || 0,
          };
        });
        setPapers(mapped);
      }
    } catch (err) {
      console.error("Error fetching project papers:", err);
    } finally {
      setLoadingPapers(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // Synchronize active tab from URL query params (e.g. ?tab=upload)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("tab") === "upload") {
        setActiveTab("upload");
      }
    }
  }, []);

  // Scoped Job Polling (Fixes the flicker / stale 100% bug completely)
  useEffect(() => {
    if (!isAnalyzing || !activeJobId) return;

    let isMounted = true;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/analysis?job_id=${encodeURIComponent(activeJobId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const job = data.job;

        // Strictly verify that the returned job matches the currently active job ID
        if (!job || job.id !== activeJobId || !isMounted) return;

        if (job.status === "processing" || job.status === "pending") {
          const total = job.total_papers || totalToProcess;
          const processed = job.processed_papers || 0;
          setProcessedCount(processed);
          setTotalToProcess(total);
          setCurrentStage(job.current_stage || "validating");
          if (job.current_paper_title) {
            setActivePaperTitle(job.current_paper_title);
          }
          // Calculate realistic live progress
          const serverPct = job.progress_percent ?? Math.round((processed / total) * 100);
          setProgressLevel(Math.max(serverPct, 8));
        } else if (job.status === "completed") {
          setProgressLevel(100);
          setCurrentStage("completed");
          setIsAnalyzing(false);
          setJobCompleted(true);
          setAnalyzingPaperId(null);
          fetchPapers(); // Refresh table to show new Analyzed badges
        } else if (job.status === "failed") {
          setIsAnalyzing(false);
          setAnalyzingPaperId(null);
          alert(`Analysis encountered an error: ${job.error_message || "Could not complete analysis"}`);
          fetchPapers();
        }
      } catch (err) {
        console.error("Analysis poll error:", err);
      }
    };

    poll();
    const interval = setInterval(poll, 1400);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAnalyzing, activeJobId, projectId, totalToProcess, fetchPapers]);

  // Counters
  const totalCount = papers.length;
  const analyzedCount = papers.filter((p) => p.status === "analyzed").length;
  const notAanalyzed = totalCount - analyzedCount;

  // Filtered & Sorted papers
  const filteredPapers = useMemo(() => {
    const result = papers.filter((paper) => {
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        paper.title.toLowerCase().includes(q) ||
        paper.authors.toLowerCase().includes(q) ||
        paper.venue.toLowerCase().includes(q) ||
        paper.tags.some((t) => t.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "all" || paper.status === statusFilter;

      return matchesQuery && matchesStatus;
    });

    result.sort((a, b) => {
      if (sortOption === "az") {
        return a.title.localeCompare(b.title);
      } else if (sortOption === "za") {
        return b.title.localeCompare(a.title);
      } else if (sortOption === "size") {
        return b.size - a.size;
      } else {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

    return result;
  }, [papers, searchQuery, statusFilter, sortOption]);

  // Selection handlers
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

  // Trigger batch analysis via backend pipeline
  const triggerBatchAnalysis = async () => {
    const targetIds =
      selectedPaperIds.length > 0
        ? selectedPaperIds
        : papers.filter((p) => p.status === "pending").map((p) => p.id);

    if (targetIds.length === 0) {
      alert("No unanalyzed papers to analyze. Please select papers or upload new preprints.");
      return;
    }

    // Initialize progress state immediately without stale 100% or flickering
    setActiveJobId(null);
    setJobCompleted(false);
    setShowProgressBar(true);
    setIsAnalyzing(true);
    setProgressLevel(5);
    setCurrentStage("validating");
    setActivePaperTitle(`Preparing batch analysis for ${targetIds.length} preprints...`);
    setProcessedCount(0);
    setTotalToProcess(targetIds.length);

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_ids: targetIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.job_id) throw new Error(data.error || "Failed to start analysis");
      setActiveJobId(data.job_id); // Set the scoped job ID
      setSelectedPaperIds([]);
    } catch (err: any) {
      alert(`Could not start analysis: ${err.message}`);
      setIsAnalyzing(false);
      setShowProgressBar(false);
    }
  };

  // Analyze single paper
  const analyzeSinglePaper = async (id: string) => {
    const paper = papers.find((p) => p.id === id);
    if (!paper) return;

    // Highlight row being analyzed and initialize progress bar
    setAnalyzingPaperId(id);
    setActiveJobId(null);
    setJobCompleted(false);
    setShowProgressBar(true);
    setIsAnalyzing(true);
    setProgressLevel(8);
    setCurrentStage("validating");
    setActivePaperTitle(paper.title);
    setProcessedCount(0);
    setTotalToProcess(1);

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_id: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.job_id) throw new Error(data.error || "Failed to start analysis");
      setActiveJobId(data.job_id); // Set the scoped job ID
    } catch (err: any) {
      alert(`Could not analyze paper: ${err.message}`);
      setIsAnalyzing(false);
      setShowProgressBar(false);
      setAnalyzingPaperId(null);
    }
  };

  // Delete single paper
  const deleteSinglePaper = async (id: string) => {
    if (!confirm("Are you sure you want to remove this paper from your project?")) return;

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/papers/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete paper");

      setPapers((prev) => prev.filter((p) => p.id !== id));
      setSelectedPaperIds((prev) => prev.filter((item) => item !== id));
    } catch (err: any) {
      alert(`Error deleting paper: ${err.message}`);
    }
  };

  // Batch delete selected papers
  const batchDeleteSelected = async () => {
    if (selectedPaperIds.length === 0) return;
    if (!confirm(`Are you sure you want to remove ${selectedPaperIds.length} selected papers?`)) return;

    const toDelete = [...selectedPaperIds];
    for (const id of toDelete) {
      try {
        await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/papers/${encodeURIComponent(id)}`,
          { method: "DELETE" }
        );
      } catch (err) {
        console.error(`Error deleting paper ${id}:`, err);
      }
    }

    setPapers((prev) => prev.filter((p) => !toDelete.includes(p.id)));
    setSelectedPaperIds([]);
  };

  // PDF Selection and Staged Upload Actions
  const handleSelectFile = (file: File) => {
    setUploadError(null);
    setUploadSuccessInfo(null);

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setUploadError("Only PDF documents (.pdf) are supported at this time.");
      return;
    }
    if (file.size === 0 || file.size > 15 * 1024 * 1024) {
      setUploadError("PDF file size must be between 1 byte and 15 MB.");
      return;
    }

    setStagedFile(file);
    const cleaned = file.name
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
    setCustomTitle(cleaned || "Research Paper");
    setCustomAuthors("");
  };

  const handleConfirmUpload = async () => {
    if (!stagedFile) return;
    const finalTitle = customTitle.trim() || stagedFile.name.replace(/\.pdf$/i, "").trim() || "Research Paper";
    if (!finalTitle) {
      setUploadError("Please provide a name or title for this PDF.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(25);
    setUploadError(null);

    const uploadId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const sizeMb = (stagedFile.size / (1024 * 1024)).toFixed(1);
    const sizeLabel = `${sizeMb} MB • PDF`;

    // Add to transfers history
    setUploads((prev) => [
      {
        id: uploadId,
        name: finalTitle,
        sizeLabel,
        type: "file",
        progress: 35,
        status: "active",
        subtext: "Uploading to private Supabase Storage…",
      },
      ...prev,
    ]);

    try {
      const formData = new FormData();
      formData.set("file", stagedFile);
      formData.set("title", finalTitle);
      if (customAuthors.trim()) {
        formData.set("authors", customAuthors.trim());
      }

      setUploadProgress(65);

      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/papers/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload PDF");
      }

      setUploadProgress(100);
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? { ...u, progress: 100, status: "completed", subtext: "Saved to Supabase Storage & Database" }
            : u
        )
      );

      const paperId = data.paper?.id || data.paper?.paper_id || uploadId;
      setUploadSuccessInfo({
        id: paperId,
        title: finalTitle,
        filename: stagedFile.name,
        sizeLabel,
      });

      // Refresh papers list so it appears in analysis table immediately with status pending
      await fetchPapers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? { ...u, progress: 0, status: "paused", warning: msg }
            : u
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetUpload = () => {
    setStagedFile(null);
    setCustomTitle("");
    setCustomAuthors("");
    setUploadError(null);
    setUploadSuccessInfo(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectFile(e.target.files[0]);
    }
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  // Determine active stepper index
  const activeStepIdx = getActiveStepIndex(currentStage);

  return (
    <div className="bg-background text-on-surface font-body-md text-body-md antialiased min-h-screen flex selection:bg-primary-container selection:text-on-primary-container">
      {/* 1. LEFT SIDEBAR */}
      <ProjectSidebar activeTab="analysis" projectId={projectId} />

      {/* 2. MAIN RESEARCH WORKSPACE AREA */}
      <div className="ml-sidebar-width flex-1 flex flex-col min-w-0 bg-background min-h-screen">
        {/* Top Bar Header */}
        <header className="sticky top-0 z-40 bg-surface-container-lowest/85 backdrop-blur-md px-6 py-3 flex items-center justify-between border-b border-outline-variant/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
              <Link href="/projects" className="hover:text-on-surface transition-colors">
                Projects
              </Link>
              <span className="text-outline">/</span>
              <Link href={`/projects/${projectId}`} className="hover:text-on-surface transition-colors">
                {projectId}
              </Link>
              <span className="text-outline">/</span>
              <span className="text-on-surface font-semibold">Upload &amp; Analysis</span>
            </div>
          </div>
        </header>

        {/* MAIN CONTAINER */}
        <main className="flex-grow py-6 px-6 lg:px-10 max-w-7xl w-full flex flex-col gap-lg mx-auto">
          {/* Primary Navigation Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md">
            <div className="flex items-center gap-sm bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/30 w-fit">
              <button
                onClick={() => setActiveTab("upload")}
                className={`tab-trigger flex items-center gap-2 px-xl py-2 rounded-lg font-label-md text-label-md transition-all duration-200 cursor-pointer ${
                  activeTab === "upload"
                    ? "bg-primary-container text-on-primary-container font-semibold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-lg">cloud_upload</span>
                <span>Upload</span>
              </button>
              <button
                onClick={() => setActiveTab("analyze")}
                className={`tab-trigger flex items-center gap-2 px-xl py-2 rounded-lg font-label-md text-label-md transition-all duration-200 cursor-pointer ${
                  activeTab === "analyze"
                    ? "bg-primary-container text-on-primary-container font-semibold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-lg">psychology</span>
                <span>Paper Analyze ({totalCount})</span>
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-code-sm bg-tertiary-container/30 text-tertiary-fixed border border-tertiary/20">
                  {totalCount}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-md text-code-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span>SupervisorX AI: Active</span>
              </span>
              <span className="text-outline-variant">|</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Cloud Supabase: Connected</span>
              </span>
            </div>
          </div>

          {/* TAB 1: UPLOAD SECTION */}
          {activeTab === "upload" && (
            <div className="workspace-tab-panel flex flex-col space-y-gutter w-full">
              <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
                <div>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                    Research Upload Center
                  </h1>
                  <p className="text-on-surface-variant mt-xs max-w-[700px]">
                    Upload PDF research manuscripts, preprints, and papers directly into your SupervisorX workspace. 
                    Set custom titles and analyze them with multimodal AI.
                  </p>
                </div>
                <div className="flex items-center gap-sm">
                  <button
                    onClick={() => setActiveTab("analyze")}
                    className="px-md py-2 rounded-lg bg-surface-container-high border border-outline-variant text-primary font-label-md text-xs hover:bg-surface-variant flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    <span>Go to Paper Analyze</span>
                  </button>
                </div>
              </header>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {/* Error Notification Banner */}
              {uploadError && (
                <div className="p-4 rounded-xl bg-error/10 border border-error/30 text-error flex items-start justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-lg shrink-0">error</span>
                    <span className="text-xs font-medium">{uploadError}</span>
                  </div>
                  <button
                    onClick={() => setUploadError(null)}
                    className="text-error hover:opacity-75 transition-opacity"
                    title="Dismiss"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              )}

              {/* SUCCESS BANNER & NEXT ACTIONS */}
              {uploadSuccessInfo ? (
                <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 to-surface-container-low shadow-lg space-y-6 animate-in fade-in duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl">check_circle</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-xl font-bold text-on-surface">
                        Manuscript Successfully Uploaded!
                      </h2>
                      <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                        Your PDF has been securely stored in Supabase Storage and registered in your project database. 
                        It is ready in your library and marked as <span className="text-amber-400 font-semibold">Not Analyzed</span> in the analysis center.
                      </p>
                    </div>
                  </div>

                  {/* Upload Summary Card */}
                  <div className="p-4 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                      </div>
                      <div>
                        <div className="font-semibold text-on-surface text-sm">
                          {uploadSuccessInfo.title}
                        </div>
                        <div className="text-[11px] text-on-surface-variant flex items-center gap-2 mt-0.5">
                          <span>{uploadSuccessInfo.filename}</span>
                          <span>•</span>
                          <span>{uploadSuccessInfo.sizeLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-code-sm bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        <span>Not Analyzed</span>
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setActiveTab("analyze");
                        if (uploadSuccessInfo?.id) {
                          setSelectedPaperIds([uploadSuccessInfo.id]);
                        }
                      }}
                      className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-xs font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-md cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">psychology</span>
                      <span>Go to Paper Analyze</span>
                    </button>

                    <Link
                      href={`/projects/${projectId}/library`}
                      className="px-4 py-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40 hover:bg-surface-variant text-on-surface font-label-md text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base text-primary">library_books</span>
                      <span>View in Paper Library</span>
                    </Link>

                    <button
                      onClick={handleResetUpload}
                      className="px-4 py-2.5 rounded-lg bg-surface-container border border-outline-variant/30 hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      <span>Upload Another PDF</span>
                    </button>
                  </div>
                </div>
              ) : stagedFile ? (
                /* STAGED FILE CONFIGURATION & CUSTOM TITLE CARD */
                <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-primary/30 bg-surface-container-low shadow-xl space-y-6 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 pb-4">
                    <div>
                      <h2 className="font-headline-md text-xl font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-2xl">edit_document</span>
                        <span>Configure Manuscript Details</span>
                      </h2>
                      <p className="text-xs text-on-surface-variant mt-1">
                        Review the selected PDF and customize its title/name before uploading to your project database.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetUpload}
                      disabled={isUploading}
                      className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer"
                      title="Cancel file selection"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>

                  {/* Selected PDF file summary row */}
                  <div className="p-3.5 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-on-surface truncate">
                          {stagedFile.name}
                        </div>
                        <div className="text-[11px] text-on-surface-variant font-mono">
                          {(stagedFile.size / (1024 * 1024)).toFixed(2)} MB • PDF Document
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="px-3 py-1.5 rounded-lg text-xs font-label-md bg-surface-container-highest hover:bg-surface-variant border border-outline-variant/40 text-on-surface transition-colors cursor-pointer shrink-0"
                    >
                      Change File
                    </button>
                  </div>

                  {/* Text Input Section for PDF Title / Name */}
                  <div className="space-y-4 pt-1">
                    <div>
                      <label className="block text-xs font-label-md font-semibold text-on-surface mb-1.5">
                        PDF Title / Paper Name <span className="text-primary">*</span>
                      </label>
                      <p className="text-[11px] text-on-surface-variant mb-2">
                        Set the name or title for this PDF. This will appear across your Paper Analysis, Paper Library, and citation graph.
                      </p>
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        disabled={isUploading}
                        placeholder="e.g. Attention Is All You Need"
                        className="w-full px-4 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface placeholder:text-outline focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-label-md font-semibold text-on-surface mb-1.5">
                        Authors / Research Group <span className="text-on-surface-variant font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={customAuthors}
                        onChange={(e) => setCustomAuthors(e.target.value)}
                        disabled={isUploading}
                        placeholder="e.g. Ashish Vaswani, Noam Shazeer, Niki Parmar (Google Research)"
                        className="w-full px-4 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface placeholder:text-outline focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Progress Bar (Visible while uploading) */}
                  {isUploading && (
                    <div className="space-y-2 pt-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs font-code-sm text-on-surface-variant">
                        <span className="flex items-center gap-1.5 text-primary">
                          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                          <span>Uploading to private Supabase Storage and indexing database...</span>
                        </span>
                        <span className="font-bold text-primary font-mono">{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-300 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit / Cancel Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
                    <button
                      type="button"
                      onClick={handleResetUpload}
                      disabled={isUploading}
                      className="px-4 py-2 rounded-lg text-xs font-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmUpload}
                      disabled={isUploading || !customTitle.trim()}
                      className="px-6 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-xs font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? (
                        <>
                          <span className="material-symbols-outlined text-sm animate-spin">
                            progress_activity
                          </span>
                          <span>Uploading PDF...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">cloud_upload</span>
                          <span>Upload PDF to Workspace</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* DRAG AND DROP ZONE (EMPTY STATE) */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDropFiles}
                  onClick={() => fileInputRef.current?.click()}
                  className={`glass-panel rounded-2xl p-8 sm:p-12 border-2 border-dashed transition-all duration-300 group relative overflow-hidden text-center cursor-pointer ${
                    isDragging
                      ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(77,142,255,0.2)]"
                      : "border-outline-variant/50 hover:border-primary/50 hover:bg-surface-container-low/60"
                  }`}
                >
                  <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
                  <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-tertiary/5 blur-[100px] rounded-full pointer-events-none"></div>
                  
                  <div className="relative flex flex-col items-center justify-center space-y-4 py-6 w-full max-w-[620px] mx-auto text-center">
                    <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center ink-shadow group-hover:scale-105 transition-transform duration-300 border border-outline-variant/30">
                      <span
                        className="material-symbols-outlined text-3xl text-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        cloud_upload
                      </span>
                    </div>

                    <div>
                      <h2 className="font-headline-md text-xl font-bold text-on-surface mb-1.5">
                        Drag and drop your research PDF manuscript
                      </h2>
                      <p className="text-on-surface-variant text-xs sm:text-sm leading-relaxed max-w-[480px] mx-auto">
                        Accepts PDF documents up to 15 MB. You can customize the paper title before saving.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-xs font-semibold flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-md shadow-primary/20"
                      >
                        <span className="material-symbols-outlined text-base">folder_open</span>
                        <span>Browse PDF File</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* RECENT UPLOADS TRANSFERS LIST */}
              {uploads.length > 0 && (
                <div className="space-y-sm pt-2">
                  <div className="text-xs font-label-md font-semibold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">history</span>
                    <span>Session Upload Transfers ({uploads.length})</span>
                  </div>
                  <div className="space-y-sm">
                    {uploads.map((u) => (
                      <div
                        key={u.id}
                        className="p-md rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-md">
                          <span className="material-symbols-outlined text-primary">description</span>
                          <div>
                            <div className="text-sm font-medium text-on-surface">{u.name}</div>
                            <div className="text-xs text-on-surface-variant">
                              {u.subtext || u.sizeLabel}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-md">
                          <span className={`text-xs font-bold ${u.status === "completed" ? "text-emerald-400" : "text-primary"}`}>
                            {u.status === "completed" ? "Complete" : `${u.progress}%`}
                          </span>
                          <button
                            onClick={() => removeUpload(u.id)}
                            className="text-on-surface-variant hover:text-error transition-colors"
                            title="Remove from history"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PAPER ANALYZE SECTION */}
          {activeTab === "analyze" && (
            <div className="workspace-tab-panel flex flex-col space-y-gutter w-full">
              {/* Header & Stats Banner */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md">
                <div>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                    Research Paper Analysis
                  </h1>
                  <p className="text-on-surface-variant mt-xs max-w-3xl">
                    Inspect, extract cross-citation graphs, and perform deep semantic synthesis
                    across all indexed academic publications.
                  </p>
                </div>
                <div className="flex items-center gap-sm md:gap-md flex-wrap">
                  <div className="glass-panel px-md py-sm rounded-lg flex items-center gap-sm text-code-sm border border-outline-variant/30">
                    <span className="text-on-surface-variant">Total Downloaded:</span>
                    <span className="font-bold text-on-surface">{totalCount}</span>
                  </div>
                  <div className="glass-panel px-md py-sm rounded-lg flex items-center gap-sm text-code-sm border border-outline-variant/30">
                    <span className="text-on-surface-variant">Analyzed:</span>
                    <span className="font-bold text-emerald-400">{analyzedCount}</span>
                  </div>
                  <div className="glass-panel px-md py-sm rounded-lg flex items-center gap-sm text-code-sm border border-outline-variant/30">
                    <span className="text-on-surface-variant">Not analyzed:</span>
                    <span className="font-bold text-amber-400">{notAanalyzed}</span>
                  </div>
                </div>
              </div>

              {/* Robust AI Analysis Engine Progress Card with Step-by-Step Pipeline Tracker */}
              {showProgressBar && (
                <div className="glass-panel p-lg rounded-xl border border-primary/40 relative overflow-hidden ink-shadow bg-surface-container-low transition-all duration-500 animate-fadeIn">
                  <div className="absolute -right-20 -top-20 w-56 h-56 bg-primary/10 blur-[90px] rounded-full pointer-events-none"></div>
                  <div className="absolute -left-20 -bottom-20 w-56 h-56 bg-tertiary/10 blur-[90px] rounded-full pointer-events-none"></div>
                  <div className="flex flex-col gap-md relative z-10">
                    {/* Top Row: Title, Glowing Badge, Live Metrics, Dismiss Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                      <div className="flex items-center gap-md">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                            jobCompleted
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                              : "bg-primary/20 text-primary border-primary/30 shadow-[0_0_15px_rgba(77,142,255,0.25)]"
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-xl ${
                              isAnalyzing ? "animate-spin" : ""
                            }`}
                            style={{ animationDuration: "5s" }}
                          >
                            {jobCompleted ? "check_circle" : "autorenew"}
                          </span>
                        </div>
                        <div>
                          <div className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-2 flex-wrap">
                            <span className="text-base text-on-surface font-bold">
                              AI Paper Analysis Engine
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-code-sm border ${
                                jobCompleted
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-primary/15 text-primary border-primary/30 shadow-[0_0_10px_rgba(173,198,255,0.2)]"
                              }`}
                            >
                              {!jobCompleted && (
                                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                              )}
                              <span>
                                {jobCompleted
                                  ? "All Selected Analyzed & Vectorized"
                                  : totalToProcess > 1
                                  ? `Analyzing Paper ${Math.min(processedCount + 1, totalToProcess)} of ${totalToProcess}`
                                  : "Analyzing Research Paper"}
                              </span>
                            </span>
                          </div>
                          <div className="font-code-sm text-code-sm text-on-surface-variant mt-0.5">
                            {jobCompleted ? (
                              <span className="text-emerald-400 font-medium">
                                ✓ Full semantic embeddings stored in Supabase pgvector
                              </span>
                            ) : (
                              <span>
                                {processedCount} of {totalToProcess} Papers Completed • {analyzedCount} Total Indexed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-md self-end sm:self-auto">
                        <div className="flex items-baseline sm:text-right gap-2 sm:flex-col sm:gap-0">
                          <span
                            className={`font-code-sm text-headline-lg font-bold tracking-tight drop-shadow-[0_0_12px_rgba(77,142,255,0.4)] ${
                              jobCompleted ? "text-emerald-400" : "text-primary"
                            }`}
                          >
                            {progressLevel}%
                          </span>
                          <span className="font-code-sm text-[11px] text-on-surface-variant">
                            {jobCompleted ? "Completed" : "In Progress"}
                          </span>
                        </div>
                        {jobCompleted && (
                          <button
                            onClick={() => setShowProgressBar(false)}
                            className="p-1.5 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer border border-outline-variant/30"
                            title="Dismiss Progress Card"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar: Sleek Gradient */}
                    <div className="relative w-full bg-surface-container-highest/80 h-3.5 rounded-full overflow-hidden p-0.5 border border-outline-variant/40 shadow-inner">
                      <div
                        className={`relative h-full rounded-full transition-all duration-700 ease-out overflow-hidden ${
                          jobCompleted
                            ? "bg-gradient-to-r from-emerald-600 to-teal-400 shadow-[0_0_18px_#34d399]"
                            : "bg-gradient-to-r from-blue-600 via-primary-container to-tertiary-container shadow-[0_0_18px_#4d8eff]"
                        }`}
                        style={{ width: `${progressLevel}%` }}
                      >
                        <div className="absolute inset-0 animate-shimmer"></div>
                      </div>
                    </div>

                    {/* Visual 4-Stage Stepper: Clearly explains what stage is currently running */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1 border-t border-outline-variant/20">
                      {PIPELINE_STEPS.map((step, idx) => {
                        const isDone = jobCompleted || activeStepIdx > idx;
                        const isCurrent = !jobCompleted && activeStepIdx === idx;
                        return (
                          <div
                            key={step.id}
                            className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${
                              isDone
                                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                                : isCurrent
                                ? "bg-primary/15 border-primary/40 text-primary shadow-sm"
                                : "bg-surface-container-high/40 border-outline-variant/20 text-on-surface-variant/60"
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {isDone ? (
                                <span className="material-symbols-outlined text-base text-emerald-400">
                                  check_circle
                                </span>
                              ) : isCurrent ? (
                                <span className="material-symbols-outlined text-base text-primary animate-spin">
                                  progress_activity
                                </span>
                              ) : (
                                <span className="material-symbols-outlined text-base text-outline">
                                  radio_button_unchecked
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold truncate leading-tight font-label-md">
                                {step.label}
                              </div>
                              <div className="text-[9px] truncate text-on-surface-variant/70 font-code-sm">
                                {isCurrent ? "Active Stage" : step.desc}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Row: Active Paper Title & Stage Task Details */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-code-sm text-on-surface-variant gap-1 pt-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-sm text-primary flex-shrink-0">
                          auto_awesome
                        </span>
                        <span className="text-xs truncate">
                          <span className="font-medium text-on-surface">
                            {jobCompleted ? "Done: " : "Current task: "}
                          </span>
                          <span className="text-primary font-medium">
                            {STAGE_LABELS[currentStage] || currentStage}
                          </span>
                          {activePaperTitle && (
                            <span className="text-on-surface-variant ml-1 truncate">
                              • {activePaperTitle}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-[11px] font-code-sm text-outline flex-shrink-0 self-end sm:self-auto">
                        {jobCompleted ? (
                          <span className="text-emerald-400 font-medium">100% Vectorized</span>
                        ) : (
                          <span>ETA: Processing sequentially</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Batch Actions & Filter Controls Toolbar */}
              <div className="glass-panel p-md rounded-xl flex flex-col xl:flex-row xl:items-center justify-between gap-md border border-outline-variant/30 ink-shadow">
                {/* Left side: Checkbox Select All & Batch Action Buttons */}
                <div className="flex flex-wrap items-center gap-sm sm:gap-md">
                  <label className="flex items-center gap-2 cursor-pointer bg-surface-container-high/60 px-3 py-1.5 rounded-lg border border-outline-variant/40 hover:border-primary/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={
                        selectedPaperIds.length > 0 &&
                        selectedPaperIds.length === filteredPapers.length
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0 focus:ring-offset-0 bg-surface-container-high cursor-pointer"
                    />
                    <span className="font-label-md text-xs sm:text-label-md text-on-surface font-medium select-none">
                      Select All ({filteredPapers.length} Papers)
                    </span>
                  </label>
                  <span className="text-code-sm px-2.5 py-1.5 rounded-lg bg-surface-container-highest text-primary font-medium border border-outline-variant/30">
                    {selectedPaperIds.length} selected
                  </span>
                  <button
                    onClick={triggerBatchAnalysis}
                    disabled={isAnalyzing}
                    className="px-md py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-xs sm:text-label-md font-bold flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    <span>Analyze Selected</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-on-primary/20 text-on-primary ml-1">
                      {selectedPaperIds.length > 0 ? selectedPaperIds.length : notAanalyzed}
                    </span>
                  </button>
                  <button
                    onClick={batchDeleteSelected}
                    disabled={selectedPaperIds.length === 0}
                    className="px-md py-1.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-error font-label-md text-xs sm:text-label-md hover:bg-error-container/20 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>Remove Selected</span>
                  </button>
                </div>

                {/* Right side: Search, Filter, Sort */}
                <div className="flex flex-wrap items-center gap-sm w-full xl:w-auto">
                  <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                    <span className="material-symbols-outlined absolute left-2.5 top-2 text-on-surface-variant text-sm">
                      search
                    </span>
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-surface-container-high border border-outline-variant/40 rounded-lg text-xs font-label-md text-on-surface focus:outline-none focus:border-primary w-full transition-all placeholder:text-on-surface-variant/60"
                      placeholder="Search papers by title, author, tag..."
                      type="text"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as "all" | "analyzed" | "pending")
                    }
                    className="px-2.5 py-1.5 bg-surface-container-high border border-outline-variant/40 rounded-lg text-xs font-label-md text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="all">All Papers</option>
                    <option value="analyzed">Analyzed by AI</option>
                    <option value="pending">Not Analyzed</option>
                  </select>
                  <select
                    value={sortOption}
                    onChange={(e) =>
                      setSortOption(e.target.value as "newest" | "az" | "za" | "size")
                    }
                    className="px-2.5 py-1.5 bg-surface-container-high border border-outline-variant/40 rounded-lg text-xs font-label-md text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="newest">Sort: Newest Uploaded</option>
                    <option value="az">Sort: A to Z</option>
                    <option value="za">Sort: Z to A</option>
                    <option value="size">Sort: File Size</option>
                  </select>
                </div>
              </div>

              {/* Downloaded & Analyzed Papers Table */}
              <div className="glass-panel rounded-xl border border-outline-variant/30 overflow-hidden ink-shadow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/30 bg-surface-container-low font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                        <th className="p-md w-12 text-center">#</th>
                        <th className="p-md min-w-[320px]">
                          Research Paper Title &amp; Publication
                        </th>
                        <th className="p-md">Venue &amp; Tags</th>
                        <th className="p-md">Size &amp; Downloaded</th>
                        <th className="p-md min-w-[150px]">Status</th>
                        <th className="p-md text-right min-w-[210px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 font-label-md text-xs">
                      {loadingPapers && (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-outline">
                            <div className="flex items-center justify-center gap-2">
                              <span className="material-symbols-outlined animate-spin text-primary">
                                autorenew
                              </span>
                              <span>Loading project papers from Supabase...</span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {!loadingPapers && filteredPapers.map((paper) => {
                        const isChecked = selectedPaperIds.includes(paper.id);
                        const isPaperActivelyAnalyzing = analyzingPaperId === paper.id;

                        return (
                          <tr
                            key={paper.id}
                            className={`paper-row transition-colors ${
                              isPaperActivelyAnalyzing
                                ? "bg-primary/5 border-l-2 border-primary"
                                : "hover:bg-surface-container-high/40"
                            }`}
                          >
                            <td className="p-md text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleRow(paper.id)}
                                className="paper-checkbox w-4 h-4 rounded border-outline-variant text-primary focus:ring-0 bg-surface-container-high cursor-pointer"
                              />
                            </td>
                            <td className="p-md">
                              <div className="flex items-start gap-md">
                                <div
                                  className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    isPaperActivelyAnalyzing
                                      ? "bg-primary/20 border-primary/40 text-primary shadow-[0_0_10px_rgba(77,142,255,0.3)]"
                                      : paper.status === "analyzed"
                                      ? "bg-primary/10 border-primary/20 text-primary"
                                      : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                  }`}
                                >
                                  <span
                                    className={`material-symbols-outlined text-lg ${
                                      isPaperActivelyAnalyzing ? "animate-spin" : ""
                                    }`}
                                  >
                                    {isPaperActivelyAnalyzing
                                      ? "progress_activity"
                                      : "article"}
                                  </span>
                                </div>
                                <div>
                                  <button
                                    onClick={() => setInsightsPaper(paper)}
                                    className="font-medium text-on-surface text-sm hover:text-primary transition-colors flex items-center gap-1.5 text-left cursor-pointer"
                                  >
                                    <span>{paper.title}</span>
                                    <span className="material-symbols-outlined text-xs text-outline">
                                      north_east
                                    </span>
                                  </button>
                                  <div className="text-code-sm text-on-surface-variant mt-0.5">
                                    {paper.authors}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-md font-code-sm text-on-surface-variant">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] bg-surface-container-highest border ${
                                    paper.status === "pending"
                                      ? "text-tertiary border-tertiary/20"
                                      : "text-primary border-primary/20"
                                  }`}
                                >
                                  {paper.venue}
                                </span>
                                {paper.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-2 py-0.5 rounded text-[11px] bg-surface-variant text-on-surface-variant"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-md font-code-sm text-on-surface-variant">
                              <div className="text-on-surface font-medium">
                                {paper.sizeLabel}
                              </div>
                              <div className="text-[11px] text-outline">
                                {paper.timeAgo}
                              </div>
                            </td>
                            <td className="p-md status-cell">
                              {isPaperActivelyAnalyzing ? (
                                <span className="status-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-code-sm bg-primary/20 text-primary border border-primary/30 shadow-[0_0_8px_rgba(77,142,255,0.25)] animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                                  <span>Analyzing AI...</span>
                                </span>
                              ) : paper.status === "analyzed" ? (
                                <span className="status-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-code-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <span className="material-symbols-outlined text-xs">
                                    check_circle
                                  </span>
                                  <span>Analyzed by AI</span>
                                </span>
                              ) : (
                                <span className="status-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-code-sm bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  <span className="material-symbols-outlined text-xs">
                                    schedule
                                  </span>
                                  <span>Not Analyzed</span>
                                </span>
                              )}
                            </td>
                            <td className="p-md text-right">
                              <div className="inline-flex items-center gap-1 justify-end">
                                {paper.status === "analyzed" ? (
                                  <button
                                    onClick={() => setInsightsPaper(paper)}
                                    className="px-2.5 py-1 rounded text-[11px] font-code-sm bg-surface-container-high border border-outline-variant/40 hover:border-primary text-primary transition-colors flex items-center gap-1 cursor-pointer"
                                    title="View Insights / Summary"
                                  >
                                    <span className="material-symbols-outlined text-xs">
                                      visibility
                                    </span>
                                    <span>Insights</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => analyzeSinglePaper(paper.id)}
                                    disabled={isAnalyzing}
                                    className="px-2.5 py-1 rounded text-[11px] font-code-sm bg-primary text-on-primary font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-50"
                                  >
                                    <span className="material-symbols-outlined text-xs">
                                      auto_awesome
                                    </span>
                                    <span>Analyze Now</span>
                                  </button>
                                )}

                                <a
                                  href={`/api/projects/${encodeURIComponent(projectId)}/papers/${encodeURIComponent(paper.paper_id || paper.id)}/file`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-on-surface-variant hover:text-primary rounded hover:bg-surface-variant/40 transition-colors cursor-pointer"
                                  title="Download PDF"
                                >
                                  <span className="material-symbols-outlined text-base">
                                    download
                                  </span>
                                </a>
                                <button
                                  onClick={() => deleteSinglePaper(paper.id)}
                                  className="p-1.5 text-on-surface-variant hover:text-error rounded hover:bg-error-container/20 transition-colors cursor-pointer"
                                  title="Remove"
                                >
                                  <span className="material-symbols-outlined text-base">
                                    delete
                                  </span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {!loadingPapers && filteredPapers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-outline">
                            No papers matching your search or filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* INSIGHTS SUMMARY MODAL */}
        {insightsPaper && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setInsightsPaper(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
          >
            <div className="w-full max-w-[720px] max-h-[85vh] overflow-y-auto rounded-2xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-5">
              <div className="flex items-start justify-between pb-3 border-b border-outline-variant/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-base font-semibold text-on-surface">
                      {insightsPaper.title}
                    </h3>
                    <div className="text-code-sm text-on-surface-variant text-xs mt-0.5">
                      {insightsPaper.authors} • {insightsPaper.venue}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setInsightsPaper(null)}
                  className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              <div className="space-y-4 text-xs font-body-md text-on-surface-variant">
                {insightsPaper.insights?.abstract_synthesis && (
                  <div>
                    <h4 className="text-on-surface font-semibold uppercase tracking-wider font-code-sm text-[11px] mb-1">
                      Paper Summary &amp; Research Problem
                    </h4>
                    <p className="bg-surface-container p-3 rounded-lg border border-outline-variant/30 text-on-surface leading-relaxed">
                      {insightsPaper.insights.abstract_synthesis}
                    </p>
                  </div>
                )}

                {insightsPaper.insights?.methodology && (
                  <div>
                    <h4 className="text-on-surface font-semibold uppercase tracking-wider font-code-sm text-[11px] mb-1">
                      Methodology &amp; Proposed Architecture
                    </h4>
                    <p className="bg-surface-container p-3 rounded-lg border border-outline-variant/30 text-on-surface leading-relaxed">
                      {insightsPaper.insights.methodology}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/30">
                    <span className="text-outline text-[10px] font-code-sm uppercase block">
                      Indexed Chunks
                    </span>
                    <span className="text-base font-bold text-primary font-code-sm">
                      {insightsPaper.chunks_count || "Pending"}
                    </span>
                  </div>
                  <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/30">
                    <span className="text-outline text-[10px] font-code-sm uppercase block">
                      Vector Dimension
                    </span>
                    <span className="text-base font-bold text-tertiary font-code-sm">
                      2048-D
                    </span>
                  </div>
                  <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/30">
                    <span className="text-outline text-[10px] font-code-sm uppercase block">
                      Visual Items
                    </span>
                    <span className="text-base font-bold text-emerald-400 font-code-sm">
                      {insightsPaper.figures_count ?? 0} Extracted
                    </span>
                  </div>
                </div>

                {insightsPaper.insights?.key_contributions && (
                  <div>
                    <h4 className="text-on-surface font-semibold uppercase tracking-wider font-code-sm text-[11px] mb-1">
                      Key Contributions &amp; Cross-References
                    </h4>
                    <ul className="list-disc pl-4 space-y-1 bg-surface-container p-3 rounded-lg border border-outline-variant/30 text-on-surface leading-relaxed">
                      {insightsPaper.insights.key_contributions.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="text-on-surface font-semibold uppercase tracking-wider font-code-sm text-[11px] mb-1">
                    Semantic Tags &amp; pgvector Index
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    {insightsPaper.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-code-sm text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                    <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/30 font-code-sm text-xs">
                      #pgvector-2048
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/30 font-code-sm text-xs">
                      #Nemotron-Embed
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
                <a
                  href={`/api/projects/${encodeURIComponent(projectId)}/papers/${encodeURIComponent(insightsPaper.paper_id || insightsPaper.id)}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary border border-primary/30 text-xs font-label-md transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>View Original PDF</span>
                </a>
                <button
                  onClick={() => setInsightsPaper(null)}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-xs font-label-md font-medium transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="w-full py-2xl border-t border-outline-variant/20 bg-surface-container-lowest mt-auto">

        </footer>
      </div>
    </div>
  );
}
