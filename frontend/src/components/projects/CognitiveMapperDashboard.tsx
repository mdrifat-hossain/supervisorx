"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import ProjectSidebar from "@/components/common/ProjectSidebar";

interface ProjectDetails {
  id: string;
  title: string;
  domain: string;
  description: string;
  color?: string;
}

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

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mIdx = parseInt(month, 10) - 1;
  return `${monthNames[mIdx] || month} ${parseInt(day, 10)}, ${year}`;
}

export default function CognitiveMapperDashboard({
  projectId = "cognitive-mapper",
  projectName,
}: {
  projectId?: string;
  projectName?: string;
}) {
  const [projectData, setProjectData] = useState<ProjectDetails | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Editor");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Dynamic Project Papers & Stats
  const [papers, setPapers] = useState<any[]>([]);
  const [, setLoadingPapers] = useState(true);

  // Live Analysis Engine Progress State
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [progressLevel, setProgressLevel] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStage, setCurrentStage] = useState("validating");
  const [activePaperTitle, setActivePaperTitle] = useState("");
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(1);
  const [jobCompleted, setJobCompleted] = useState(false);

  const fetchProjectDetails = useCallback(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.project) {
          setProjectData(data.project);
        }
      })
      .catch((err) => {
        console.error("Error fetching project details:", err);
      });
  }, [projectId]);

  const fetchPapers = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/papers`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.papers)) {
        setPapers(data.papers);
      }
    } catch (err) {
      console.error("Error fetching project papers for dashboard:", err);
    } finally {
      setLoadingPapers(false);
    }
  }, [projectId]);

  // Dynamic Project Research Activity & Cadence State
  const [cadenceRange, setCadenceRange] = useState("last_6_months");
  const [activityData, setActivityData] = useState<{
    range: string;
    weeks: Array<
      Array<{
        date: string;
        dayOfWeek: number;
        count: number;
        level: number;
        isToday: boolean;
        isInRange: boolean;
        breakdown: { chat: number; download: number; analyzed: number; other: number };
      }>
    >;
    monthHeaders: Array<{ label: string; weekIndex: number }>;
    months?: Array<{
      name: string;
      fullName: string;
      year: number;
      month: number;
      totalActions: number;
      activeDaysCount: number;
      weeks: Array<
        Array<{
          date: string | null;
          dayNumber: number | null;
          dayOfWeek: number;
          count: number;
          level: number;
          isToday: boolean;
          isInRange: boolean;
          breakdown: { chat: number; download: number; analyzed: number; other: number };
        }>
      >;
    }>;
    summary: {
      totalActions: number;
      chatInteractions: number;
      papersDownloaded: number;
      papersAnalyzed: number;
      otherActions: number;
      activeDaysCount: number;
      currentStreak: number;
      longestStreak: number;
    };
  } | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    count: number;
    breakdown: { chat: number; download: number; analyzed: number; other: number };
  } | null>(null);

  const fetchActivityData = useCallback(
    async (range: string) => {
      if (!projectId) return;
      setLoadingActivity(true);
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/activity?range=${encodeURIComponent(range)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setActivityData(data);
          }
        }
      } catch (err) {
        console.error("Error fetching project activity cadence:", err);
      } finally {
        setLoadingActivity(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    fetchProjectDetails();
    fetchPapers();
  }, [fetchProjectDetails, fetchPapers]);

  useEffect(() => {
    fetchActivityData(cadenceRange);
  }, [cadenceRange, fetchActivityData]);

  const fetchPapersRef = useRef(fetchPapers);
  fetchPapersRef.current = fetchPapers;
  const fetchActivityDataRef = useRef(fetchActivityData);
  fetchActivityDataRef.current = fetchActivityData;
  const cadenceRangeRef = useRef(cadenceRange);
  cadenceRangeRef.current = cadenceRange;

  // Poll for active analysis progress (same as Upload & Analysis page, auto-dismisses on completion)
  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;
    let dismissTimer: NodeJS.Timeout | null = null;

    const checkAnalysisStatus = async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/analysis`);
        if (!res.ok) return;
        const data = await res.json();
        const job = data.job;

        if (!isMounted) return;

        if (job && (job.status === "processing" || job.status === "pending")) {
          setShowProgressBar(true);
          setIsAnalyzing(true);
          setJobCompleted(false);

          const total = job.total_papers || 1;
          const processed = job.processed_papers || 0;
          setProcessedCount(processed);
          setTotalToProcess(total);
          setCurrentStage(job.current_stage || "validating");
          if (job.current_paper_title) {
            setActivePaperTitle(job.current_paper_title);
          }
          const serverPct = job.progress_percent ?? Math.round((processed / total) * 100);
          setProgressLevel(Math.max(serverPct, 8));
        } else if (job && job.status === "completed") {
          if (isAnalyzing) {
            setProgressLevel(100);
            setCurrentStage("completed");
            setIsAnalyzing(false);
            setJobCompleted(true);
            fetchPapersRef.current(); // refresh cards immediately
            fetchActivityDataRef.current(cadenceRangeRef.current); // refresh activity immediately
            dismissTimer = setTimeout(() => {
              if (isMounted) setShowProgressBar(false);
            }, 3000);
          }
        } else {
          if (!jobCompleted) {
            setShowProgressBar(false);
            setIsAnalyzing(false);
          }
        }
      } catch (err) {
        console.error("Dashboard analysis status check error:", err);
      }
    };

    checkAnalysisStatus();
    const interval = setInterval(checkAnalysisStatus, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [projectId, isAnalyzing, jobCompleted]);

  const displayTitle =
    projectData?.title ||
    projectName ||
    (projectId === "cognitive-mapper" ? "Cognitive Mapper v4" : "Project Workspace");

  const displayDomain =
    projectData?.domain ||
    (projectId === "cognitive-mapper" ? "Neural Networks" : "AI Research");

  const displayDescription =
    projectData !== null
      ? projectData.description
      : projectId === "cognitive-mapper"
      ? "Exploration of latent space dynamics and multi-head attention entropy in high-dimensional transformer representations. Cross-referencing 42 literature baselines against synthetic residual probes."
      : "";

  // Working Note states
  const [completedNote, setCompletedNote] = useState(
    "Benchmarked 24 attention heads against baseline BERT representations; isolated 3 attention collapse modes."
  );
  const [inProgressNote, setInProgressNote] = useState(
    "Evaluating gradient flow across layers 8-12 under severe quantization."
  );
  const [nextStepNote, setNextStepNote] = useState(
    "Download 5 comparative preprint papers on sparse attention entropy and run shadow pipeline validation."
  );

  const handleSaveNote = () => {
    setSaveStatus("saved");
    setIsEditingNote(false);
    setTimeout(() => {
      setSaveStatus("idle");
    }, 1800);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Invitation dispatched to the collaborator.");
    setIsInviteModalOpen(false);
  };

  return (
    <div className="bg-background text-on-surface font-body-md text-body-md antialiased min-h-screen flex selection:bg-primary-container selection:text-on-primary-container">
      {/* ========================================== */}
      {/* 1. LEFT SIDEBAR (Common ProjectSidebar)    */}
      {/* ========================================== */}
      <ProjectSidebar activeTab="dashboard" projectId={projectId} projectName={displayTitle} />

      {/* ========================================== */}
      {/* 2. MAIN RESEARCH CANVAS AREA              */}
      {/* ========================================== */}
      <div className="ml-sidebar-width flex-1 flex flex-col min-w-0 bg-background">
        {/* Top Bar Header */}
        <header className="sticky top-0 z-40 bg-surface-container-lowest/85 backdrop-blur-md px-6 py-3 flex items-center justify-between border-b border-outline-variant/20">
          {/* Left: Breadcrumbs & Live Sync */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
              <Link href="/projects" className="hover:text-on-surface transition-colors">
                Projects
              </Link>
              <span className="text-outline">/</span>
              <span className="hover:text-on-surface cursor-pointer text-on-surface font-semibold">
                {displayTitle}
              </span>
              <span className="text-outline">/</span>
              <span className="text-primary font-medium">Dashboard</span>
            </div>

            {/* Live Sync Indicator Badge */}
            {/* <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-container border border-primary/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="font-label-md text-code-sm text-primary tracking-tight">
                Active Run 44 • 68% complete
              </span>
            </div> */}
          </div>

          {/* Right: Teammates & Primary Action */}
          {false && (
          <div className="flex items-center gap-3">
            {/* Teammates avatar stack */}
            <div className="flex items-center -space-x-2 mr-2">
              <div
                className="w-7 h-7 rounded-full bg-surface-container-high border-2 border-background flex items-center justify-center text-[10px] font-label-md text-on-surface"
                title="Alex Liang (Lead PI)"
              >
                AL
              </div>
              <div
                className="w-7 h-7 rounded-full bg-surface-container-highest border-2 border-background flex items-center justify-center text-[10px] font-label-md text-on-surface"
                title="Sophia Kim (AI Engineer)"
              >
                SK
              </div>
              <div
                className="w-7 h-7 rounded-full bg-surface-variant border-2 border-background flex items-center justify-center text-[10px] font-label-md text-on-surface"
                title="Julian Diaz (Bio-NLP)"
              >
                JD
              </div>
              <div
                className="w-7 h-7 rounded-full bg-primary-container border-2 border-background flex items-center justify-center text-[10px] font-label-md text-on-primary-container font-semibold"
                title="Dr. Researcher (You)"
              >
                ME
              </div>
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="w-7 h-7 rounded-full bg-surface-container border-2 border-background hover:bg-surface-variant text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
                title="Invite Teammate"
              >
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </div>

            {/* Notification & History */}
            <div className="flex items-center gap-1 border-r border-outline-variant/30 pr-3">
              <button
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md transition-colors cursor-pointer"
                title="Notifications"
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
              </button>
              <button
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md transition-colors cursor-pointer"
                title="Pipeline History"
              >
                <span className="material-symbols-outlined text-xl">history</span>
              </button>
            </div>

            {/* Open Paper Chatbot CTA */}
            <Link
              href={`/projects/${projectId}/chatbot`}
              className="py-1.5 px-3.5 rounded-lg bg-surface-container-high border border-primary/40 hover:border-primary text-primary hover:bg-surface-container-highest font-headline-md text-label-md font-medium flex items-center gap-2 transition-all duration-150 active:scale-95 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">chat</span>
              <span>Open Paper Chatbot</span>
            </Link>
          </div>  )}
        </header>

        {/* Canvas Scrollable Body */}
        <main className="p-6 max-w-container-max mx-auto w-full flex flex-col gap-6">
          {/* SECTION 1: TOP PROJECT HEADER */}
          <section className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
                    {displayTitle}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-label-md text-code-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">psychology</span>
                    {displayDomain}
                  </span>
                  {/* <span className="text-outline font-label-md text-code-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    Last active 12m ago
                  </span> */}
                </div>
                {displayDescription ? (
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                    {displayDescription}
                  </p>
                ) : null}
              </div>

              {/* Quick Actions */}
              {/* <div className="flex items-center gap-2 shrink-0">
                <button className="px-3 py-2 rounded-lg bg-surface-container border border-outline-variant/30 hover:border-outline text-on-surface text-label-md font-label-md flex items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-base">fork_right</span>
                  <span>Fork Run</span>
                </button>
                <button className="px-3.5 py-2 rounded-lg bg-primary-container text-on-primary-container font-headline-md text-label-md font-semibold flex items-center gap-2 hover:bg-primary transition-all cursor-pointer">
                  <span className="material-symbols-outlined text-base">play_arrow</span>
                  <span>Execute Probe #45</span>
                </button>
              </div> */}
            </div>
          </section>

          {/* SECTION 2: PROMINENT 'LAST WORKING NOTE' */}
          {false && (
          <section className="bg-surface-container-low border-2 border-primary/30 rounded-xl p-5 relative shadow-[0_0_24px_rgba(77,142,255,0.08)] bg-gradient-to-b from-surface-container to-surface-container-low">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-outline-variant/30">
              <div className="flex items-center gap-2.5">
                <span className="flex p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/25">
                  <span className="material-symbols-outlined text-xl">sticky_note_2</span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
                      Last Working Note &amp; Continuity Log
                    </h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-label-md bg-primary/15 text-primary border border-primary/30 animate-pulse">
                      PERSISTENT CONTEXT
                    </span>
                  </div>
                  <p className="text-xs font-code-sm text-outline">
                    Designed for zero-cognitive-load resumption after workflow interruptions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <span className="text-xs font-code-sm text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-primary">schedule</span>
                    Updated today at 14:32 by{" "}
                    <strong className="text-on-surface font-medium">Dr. Researcher</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingNote(!isEditingNote)}
                    className="px-3 py-1.5 rounded-md bg-surface-container-high border border-outline-variant/40 hover:border-primary text-on-surface text-label-md font-label-md flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    <span>{isEditingNote ? "Done Editing" : "Edit Note"}</span>
                  </button>
                  <button
                    onClick={handleSaveNote}
                    className={`px-3.5 py-1.5 rounded-md font-headline-md text-label-md font-medium flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                      saveStatus === "saved"
                        ? "bg-emerald-500 text-white"
                        : "bg-primary text-on-primary hover:bg-surface-tint"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {saveStatus === "saved" ? "check" : "save"}
                    </span>
                    <span>{saveStatus === "saved" ? "Saved!" : "Save Changes"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3 Structured Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {/* Box 1: What was completed */}
              <div className="bg-surface-container-lowest/80 border border-outline-variant/30 rounded-lg p-4 flex flex-col justify-between hover:border-outline-variant transition-colors group">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 font-label-md text-label-md font-semibold mb-2">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span>WHAT WAS COMPLETED</span>
                  </div>
                  {isEditingNote ? (
                    <textarea
                      rows={3}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded p-2 text-body-md text-on-surface focus:outline-none focus:border-primary resize-none"
                      value={completedNote}
                      onChange={(e) => setCompletedNote(e.target.value)}
                    />
                  ) : (
                    <p className="font-body-md text-body-md text-on-surface group-hover:text-primary-fixed-dim transition-colors">
                      {completedNote}
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between text-xs font-code-sm text-outline">
                  <span>
                    Artifact: <code className="text-primary-fixed-dim">eval_heads_v3.bin</code>
                  </span>
                  <span className="text-emerald-400 font-medium">Verified</span>
                </div>
              </div>

              {/* Box 2: Current blocker */}
              <div className="bg-surface-container-lowest/80 border border-outline-variant/30 rounded-lg p-4 flex flex-col justify-between hover:border-outline-variant transition-colors group">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 font-label-md text-label-md font-semibold mb-2">
                    <span className="material-symbols-outlined text-base">pending</span>
                    <span>CURRENT BLOCKER / IN PROGRESS</span>
                  </div>
                  {isEditingNote ? (
                    <textarea
                      rows={3}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded p-2 text-body-md text-on-surface focus:outline-none focus:border-primary resize-none"
                      value={inProgressNote}
                      onChange={(e) => setInProgressNote(e.target.value)}
                    />
                  ) : (
                    <p className="font-body-md text-body-md text-on-surface group-hover:text-amber-200 transition-colors">
                      {inProgressNote}
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between text-xs font-code-sm text-outline">
                  <span>Profiling GPU VRAM spike</span>
                  <span className="text-amber-400 font-medium">Active (PID 9042)</span>
                </div>
              </div>

              {/* Box 3: Immediate Next Step */}
              <div className="bg-surface-container-lowest/80 border border-outline-variant/30 rounded-lg p-4 flex flex-col justify-between hover:border-primary/40 transition-colors group relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-primary/10 rounded-full blur-xl pointer-events-none"></div>
                <div>
                  <div className="flex items-center gap-2 text-primary font-label-md text-label-md font-semibold mb-2">
                    <span className="material-symbols-outlined text-base">forward</span>
                    <span>IMMEDIATE NEXT STEP</span>
                  </div>
                  {isEditingNote ? (
                    <textarea
                      rows={3}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded p-2 text-body-md text-on-surface focus:outline-none focus:border-primary resize-none"
                      value={nextStepNote}
                      onChange={(e) => setNextStepNote(e.target.value)}
                    />
                  ) : (
                    <p className="font-body-md text-body-md text-on-surface group-hover:text-primary transition-colors">
                      {nextStepNote}
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between text-xs font-code-sm text-outline">
                  <span className="text-primary hover:underline cursor-pointer flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">search</span> Search ArXiv
                    Preprints
                  </span>
                  <span className="text-primary font-medium">Ready</span>
                </div>
              </div>
            </div>
          </section> 
          )}

          {/* SECTION 3: RESEARCH STATS & METRICS */}
          <section className="flex flex-col gap-4">
            {/* Dynamic Calculated Statistics */}
            {(() => {
              const totalDownloaded = papers.length;
              const analyzedCount = papers.filter((p) => p.status === "analyzed").length;
              const notAnalyzedCount = totalDownloaded - analyzedCount;
              const analyzedPercent =
                totalDownloaded > 0
                  ? Math.round((analyzedCount / totalDownloaded) * 100)
                  : 0;

              const totalSizeBytes = papers.reduce(
                (sum, p) => sum + (Number(p.file_size) || 0),
                0
              );
              const totalVectorsCount = papers.reduce(
                (sum, p) =>
                  sum + (Number(p.vectors_count) || Number(p.chunks_count) || 0),
                0
              );

              const formatStorage = (bytes: number) => {
                if (bytes <= 0) return "0.0 MB";
                const mb = bytes / (1024 * 1024);
                if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
                return `${mb.toFixed(1)} MB`;
              };

              const activeStepIdx = getActiveStepIndex(currentStage);

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Total Papers Downloaded */}
                    <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between hover:border-primary/30 transition-all hover:shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-code-sm text-on-surface-variant uppercase tracking-wider">
                          Papers Downloaded
                        </span>
                        <div className="p-2 rounded-lg bg-surface-container text-primary">
                          <span className="material-symbols-outlined text-lg">download</span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="font-headline-lg text-headline-lg font-bold text-on-surface leading-none">
                          {totalDownloaded} {totalDownloaded === 1 ? "Paper" : "Papers"}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 font-label-md text-code-sm text-emerald-400">
                          <span className="material-symbols-outlined text-xs">folder</span>
                          <span>In Project Library</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-between items-center text-xs text-outline font-label-md">
                        <Link
                          href={`/projects/${projectId}/library`}
                          className="text-primary hover:underline flex items-center justify-between w-full"
                        >
                          <span>View Library</span>
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </Link>
                      </div>
                    </div>

                    {/* Card 2: Papers Analyzed */}
                    <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between hover:border-primary/30 transition-all hover:shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-code-sm text-on-surface-variant uppercase tracking-wider">
                          Papers Analyzed
                        </span>
                        <div className="p-2 rounded-lg bg-surface-container text-primary">
                          <span className="material-symbols-outlined text-lg">analytics</span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="font-headline-lg text-headline-lg font-bold text-on-surface leading-none">
                          {analyzedCount} Analyzed
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 font-label-md text-code-sm text-emerald-400">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          <span>{analyzedPercent}% Analyzed</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-between text-xs text-outline font-label-md">
                        <span>Grounded in pgvector</span>
                        <span>{totalVectorsCount} chunks</span>
                      </div>
                    </div>

                    {/* Card 3: Papers Waiting for Analysis */}
                    <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between hover:border-primary/30 transition-all hover:shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-code-sm text-on-surface-variant uppercase tracking-wider">
                          Not Analyzed
                        </span>
                        <div className={`p-2 rounded-lg bg-surface-container ${notAnalyzedCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                          <span className="material-symbols-outlined text-lg">
                            {notAnalyzedCount > 0 ? "hourglass_top" : "task_alt"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className={`font-headline-lg text-headline-lg font-bold leading-none ${notAnalyzedCount > 0 ? "text-amber-300" : "text-emerald-400"}`}>
                          {notAnalyzedCount} {notAnalyzedCount === 1 ? "Remains" : "Remains"}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 font-label-md text-code-sm text-outline">
                          {notAnalyzedCount > 0 ? (
                            <span className="text-amber-400/90">Awaiting AI extraction</span>
                          ) : (
                            <span className="text-emerald-400/90">All papers vectorized</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-between items-center text-xs font-label-md">
                        <Link
                          className="text-primary hover:text-surface-tint font-medium underline flex items-center gap-0.5"
                          href={`/projects/${projectId}/analysis`}
                        >
                          <span>{notAnalyzedCount > 0 ? "Start Paper Analysis" : "View Analysis Center"}</span>
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </Link>
                      </div>
                    </div>

                    {/* Card 4: Total Project Storage */}
                    <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between hover:border-primary/30 transition-all hover:shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-code-sm text-on-surface-variant uppercase tracking-wider">
                          Project Storage
                        </span>
                        <div className="p-2 rounded-lg bg-surface-container text-tertiary">
                          <span className="material-symbols-outlined text-lg">database</span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="font-headline-lg text-headline-lg font-bold text-on-surface leading-none">
                          {formatStorage(totalSizeBytes)}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 font-label-md text-code-sm text-outline">
                          <span>PDFs &amp; Vector Embeddings</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-between text-xs text-outline font-label-md">
                        <span>{totalDownloaded} PDFs stored</span>
                        <span>{totalVectorsCount > 0 ? `${totalVectorsCount} vectors` : "Local vault"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Paper Analysis Live Progress Card: Appears only when analysis is running, auto-dismisses on completion */}
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
                                      ? "Analysis Complete & Vectorized"
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
                </>
              );
            })()}
          </section>

          {/* SECTION 4: RESEARCH ACTIVITY CALENDAR & CADENCE */}
          <section className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-outline-variant/20">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                    Project Research Activity &amp; Cadence
                  </h3>
                  <span className="font-label-md text-code-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                    Daily Commit &amp; Pipeline Map
                  </span>
                </div>
                <p className="text-xs font-code-sm text-outline">
                  Tracks preprint downloads, paper analyses, vector embeddings, and research chatbot queries.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label-md text-code-sm text-outline">Cadence Range:</span>
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
                          {m.name} <span className="text-[10px] font-normal text-outline">{m.year}</span>
                        </span>
                        {m.totalActions > 0 ? (
                          <span className="text-[10px] font-label-md px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                            {m.totalActions} acts
                          </span>
                        ) : (
                          <span className="text-[10px] font-label-md text-outline/60">0</span>
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
                              const tooltipTitle =
                                day.count > 0
                                  ? `${formatDateLabel(day.date)}: ${day.count} research actions (${[
                                      day.breakdown.chat ? `${day.breakdown.chat} chat` : "",
                                      day.breakdown.analyzed ? `${day.breakdown.analyzed} analyzed` : "",
                                      day.breakdown.download ? `${day.breakdown.download} downloaded` : "",
                                      day.breakdown.other ? `${day.breakdown.other} jobs/searches` : "",
                                    ]
                                      .filter(Boolean)
                                      .join(", ")})`
                                  : `${formatDateLabel(day.date)}: No research activity`;

                              return (
                                <div
                                  key={day.date}
                                  onMouseEnter={() =>
                                    setHoveredDay({
                                      date: day.date!,
                                      count: day.count,
                                      breakdown: day.breakdown,
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

            {/* Live Hover Info bar if hovering an active cell */}
            {hoveredDay && (
              <div className="mt-2 text-xs font-label-md text-on-surface-variant flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/30 animate-fadeIn">
                <span className="material-symbols-outlined text-sm text-primary">event_available</span>
                <span className="font-semibold text-on-surface">
                  {formatDateLabel(hoveredDay.date)}
                </span>
                <span className="text-outline">•</span>
                <span>
                  {hoveredDay.count > 0 ? (
                    <span className="text-primary font-medium">
                      {hoveredDay.count} total research actions (
                      {[
                        hoveredDay.breakdown.chat ? `${hoveredDay.breakdown.chat} chat` : "",
                        hoveredDay.breakdown.analyzed ? `${hoveredDay.breakdown.analyzed} analyzed` : "",
                        hoveredDay.breakdown.download ? `${hoveredDay.breakdown.download} downloaded` : "",
                        hoveredDay.breakdown.other ? `${hoveredDay.breakdown.other} other` : "",
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      )
                    </span>
                  ) : (
                    <span className="text-outline">No research activity recorded on this day</span>
                  )}
                </span>
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
              <div className="flex items-center gap-2 text-xs font-label-md text-outline">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-surface-container-high border border-outline-variant/10" title="0 actions"></div>
                <div className="w-3 h-3 rounded-sm bg-primary/25 border border-primary/30" title="1-2 actions"></div>
                <div className="w-3 h-3 rounded-sm bg-primary/50 border border-primary/50" title="3-5 actions"></div>
                <div className="w-3 h-3 rounded-sm bg-primary/75 border border-primary/70" title="6-9 actions"></div>
                <div className="w-3 h-3 rounded-sm bg-primary shadow-sm shadow-primary/30" title="10+ actions"></div>
                <span>More</span>
              </div>
            </div>
          </section>

          {/* SECTION 5: TEAMMATES & COLLABORATION PANEL */}
          {false && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Collaborators Card */}
            <div className="lg:col-span-2 bg-surface-container-low border border-outline-variant/30 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                  <div>
                    <h3 className="font-headline-md text-body-lg font-semibold text-on-surface">
                      Active Project Collaborators
                    </h3>
                    <p className="text-xs font-code-sm text-outline">
                      4 members currently mapped with permission to run vector analyses.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsInviteModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30 hover:border-primary text-primary text-label-md font-label-md flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    <span>Invite Teammate</span>
                  </button>
                </div>

                <div className="divide-y divide-outline-variant/20 mt-2">
                  {/* Collaborator 1 */}
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-container-high border border-outline-variant/40 flex items-center justify-center font-label-md text-sm font-semibold text-primary">
                        AL
                      </div>
                      <div>
                        <div className="font-headline-md text-body-md font-medium text-on-surface flex items-center gap-2">
                          Alex Liang
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-label-md bg-surface-container-highest text-outline">
                            Lead PI
                          </span>
                        </div>
                        <div className="text-xs font-code-sm text-outline">
                          alex.liang@ai-cognition.lab • Last run 2h ago
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-label-md bg-primary/10 text-primary border border-primary/25">
                        Admin
                      </span>
                      <span className="material-symbols-outlined text-outline text-lg cursor-pointer hover:text-on-surface">
                        more_vert
                      </span>
                    </div>
                  </div>

                  {/* Collaborator 2 */}
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-container-highest border border-outline-variant/40 flex items-center justify-center font-label-md text-sm font-semibold text-tertiary">
                        SK
                      </div>
                      <div>
                        <div className="font-headline-md text-body-md font-medium text-on-surface flex items-center gap-2">
                          Sophia Kim
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-label-md bg-surface-container-highest text-outline">
                            AI Engineer
                          </span>
                        </div>
                        <div className="text-xs font-code-sm text-outline">
                          s.kim@synthetic-tensors.io • Active in Chatbot
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-label-md bg-surface-container text-on-surface-variant border border-outline-variant/30">
                        Editor
                      </span>
                      <span className="material-symbols-outlined text-outline text-lg cursor-pointer hover:text-on-surface">
                        more_vert
                      </span>
                    </div>
                  </div>

                  {/* Collaborator 3 */}
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-variant border border-outline-variant/40 flex items-center justify-center font-label-md text-sm font-semibold text-secondary-fixed">
                        JD
                      </div>
                      <div>
                        <div className="font-headline-md text-body-md font-medium text-on-surface flex items-center gap-2">
                          Julian Diaz
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-label-md bg-surface-container-highest text-outline">
                            Bio-NLP Specialist
                          </span>
                        </div>
                        <div className="text-xs font-code-sm text-outline">
                          jdiaz@med-semantics.org • Uploaded 4 papers yesterday
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-label-md bg-surface-container text-on-surface-variant border border-outline-variant/30">
                        Editor
                      </span>
                      <span className="material-symbols-outlined text-outline text-lg cursor-pointer hover:text-on-surface">
                        more_vert
                      </span>
                    </div>
                  </div>

                  {/* Collaborator 4 (Current User) */}
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container border border-primary/40 flex items-center justify-center font-label-md text-sm font-semibold text-on-primary-container">
                        ME
                      </div>
                      <div>
                        <div className="font-headline-md text-body-md font-medium text-on-surface flex items-center gap-2">
                          Dr. Researcher
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-label-md bg-primary/20 text-primary border border-primary/30">
                            You (Owner)
                          </span>
                        </div>
                        <div className="text-xs font-code-sm text-outline">
                          dr.researcher@supervisorx.internal • Editing Note
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-label-md bg-primary-container text-on-primary-container font-medium">
                        Owner
                      </span>
                      <span className="material-symbols-outlined text-outline text-lg cursor-pointer hover:text-on-surface">
                        lock
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/20 flex justify-between items-center text-xs font-label-md">
                <span className="text-outline">Role permissions synced with SupervisorX Policy</span>
                <a className="text-primary hover:underline flex items-center gap-1 font-medium" href="#settings">
                  <span>Manage Teammates in Settings</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              </div>
            </div>

            {/* Quick Directory & Invite Modal Preview */}
            <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-outline-variant/20">
                  <span className="material-symbols-outlined text-primary text-xl">person_search</span>
                  <h3 className="font-headline-md text-body-lg font-semibold text-on-surface">
                    Directory Search
                  </h3>
                </div>
                <p className="text-xs font-code-sm text-outline mt-3 mb-3">
                  Search SupervisorX global repository or internal institutional directory by handle.
                </p>
                <div className="relative">
                  <span className="material-symbols-outlined text-outline absolute left-3 top-2.5 text-lg">
                    search
                  </span>
                  <input
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-xs font-label-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    placeholder="Search by email or @handle..."
                    type="text"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-xs font-label-md text-on-surface-variant uppercase tracking-wider">
                    Pending Invitations
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/20 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-headline-md font-medium text-on-surface">
                        m.turing@cam.ac.uk
                      </div>
                      <div className="text-[10px] font-code-sm text-outline">
                        Sent 1d ago • Inviting as Reviewer
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-label-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      Pending
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/20 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-headline-md font-medium text-on-surface">
                        @chen_quantum
                      </div>
                      <div className="text-[10px] font-code-sm text-outline">
                        Sent 3d ago • Inviting as Collaborator
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-label-md bg-surface-container-high text-outline border border-outline-variant/30">
                      Resend (2)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-outline-variant/20">
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="w-full py-2 px-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-on-surface text-label-md font-label-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">share</span>
                  <span>Copy Project Invite Link</span>
                </button>
              </div>
            </div>
          </section> )}
        </main>
      </div>

      {/* ========================================== */}
      {/* MODAL: INVITE TEAMMATE MODAL               */}
      {/* ========================================== */}
      {/*
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant/40 rounded-xl max-w-[560px] w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">group_add</span>
                <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                  Invite to Cognitive Mapper v4
                </h3>
              </div>
              <button
                className="text-outline hover:text-on-surface transition-colors cursor-pointer"
                onClick={() => setIsInviteModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-label-md text-on-surface-variant mb-1.5 uppercase tracking-wider">
                  Search Institutional Directory or Email
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined text-outline absolute left-3 top-2.5 text-base">
                    mail
                  </span>
                  <input
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-sm font-label-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="Search SupervisorX directory by email or @handle"
                    type="text"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-label-md text-on-surface-variant mb-1.5 uppercase tracking-wider">
                  Access Role
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-label-md">
                  {["Editor", "Reviewer", "Admin"].map((role) => (
                    <label
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={`p-2.5 rounded-lg bg-surface-container border cursor-pointer flex flex-col items-center text-center transition-all ${
                        selectedRole === role
                          ? "border-primary/50 text-primary ring-1 ring-primary/30"
                          : "border-outline-variant/30 hover:border-outline text-on-surface"
                      }`}
                    >
                      <span className="font-semibold">{role}</span>
                      <span className="text-[10px] text-outline mt-0.5">
                        {role === "Editor"
                          ? "Can run probes"
                          : role === "Reviewer"
                          ? "Read & comment"
                          : "Full control"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-container border border-outline-variant/20 flex items-center justify-between text-xs font-label-md text-outline">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">link</span>
                  Direct URL link sharing enabled
                </span>
                <span
                  onClick={() => alert("Invite link copied to clipboard!")}
                  className="text-primary cursor-pointer hover:underline"
                >
                  Copy Link
                </span>
              </div>

              <div className="mt-6 pt-4 border-t border-outline-variant/20 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-label-md font-label-md transition-colors cursor-pointer"
                  onClick={() => setIsInviteModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary-container font-headline-md text-label-md font-semibold transition-all cursor-pointer"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )} */}
    </div>
  );
}
