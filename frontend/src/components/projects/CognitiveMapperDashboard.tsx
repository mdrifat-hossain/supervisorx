"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProjectSidebar from "@/components/common/ProjectSidebar";

interface ProjectDetails {
  id: string;
  title: string;
  domain: string;
  description: string;
  color?: string;
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

  useEffect(() => {
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
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-container border border-primary/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="font-label-md text-code-sm text-primary tracking-tight">
                Active Run 44 • 68% complete
              </span>
            </div>
          </div>

          {/* Right: Teammates & Primary Action */}
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
          </div>
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
                    42 Papers
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 font-label-md text-code-sm text-emerald-400">
                    <span className="material-symbols-outlined text-xs">trending_up</span>
                    <span>+6 this week</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-between text-xs text-outline font-label-md">
                  <span>Target: 50 papers</span>
                  <span>84% of cohort</span>
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
                    28 Analyzed
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 font-label-md text-code-sm text-primary">
                    <span>66.7% coverage rate</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-between text-xs text-outline font-label-md">
                  <span>Avg pass time: 4.2m</span>
                  <span className="text-emerald-400">0 failures</span>
                </div>
              </div>

              {/* Card 3: Papers Waiting for Analysis */}
              <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between hover:border-primary/30 transition-all hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-code-sm text-on-surface-variant uppercase tracking-wider">
                    Queued for Analysis
                  </span>
                  <div className="p-2 rounded-lg bg-surface-container text-amber-400">
                    <span className="material-symbols-outlined text-lg">hourglass_top</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="font-headline-lg text-headline-lg font-bold text-amber-300 leading-none">
                    14 Queued
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 font-label-md text-code-sm text-on-surface-variant">
                    <span>3 batch tasks staged</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-between items-center text-xs font-label-md">
                  <a
                    className="text-primary hover:text-surface-tint font-medium underline flex items-center gap-0.5"
                    href="#batch"
                  >
                    <span>Start Batch Analysis</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </a>
                </div>
              </div>

              {/* Card 4: Database Embeddings Stored */}
              <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between hover:border-primary/30 transition-all hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-code-sm text-on-surface-variant uppercase tracking-wider">
                    Embeddings Stored
                  </span>
                  <div className="p-2 rounded-lg bg-surface-container text-tertiary">
                    <span className="material-symbols-outlined text-lg">database</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="font-headline-lg text-headline-lg font-bold text-on-surface leading-none">
                    1.42M Vectors
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 font-label-md text-code-sm text-outline">
                    <span>Vector Vault: 4.2 TB indexed</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-between text-xs text-outline font-label-md">
                  <span>HNSW index cosine</span>
                  <span className="text-primary font-medium">99.4% recall</span>
                </div>
              </div>
            </div>

            {/* Global Pipeline Progress Bar */}
            <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-headline-md text-body-lg font-semibold text-on-surface">
                      Global Pipeline Execution Progress
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-label-md bg-primary-container/20 text-primary border border-primary/30">
                      Total Progress: 68%
                    </span>
                  </div>
                  <p className="text-xs font-code-sm text-outline">
                    Synchronizing data across Ingestion, Vectorization, and Latent Synthesis stages.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-code-sm text-on-surface-variant">
                  <span>ETA: ~48 mins</span>
                  <span className="text-outline">|</span>
                  <span className="text-primary cursor-pointer hover:underline">
                    View Pipeline Telemetry
                  </span>
                </div>
              </div>

              {/* Segmented Progress Bar */}
              <div className="w-full bg-surface-container-lowest h-3.5 rounded-full overflow-hidden flex p-0.5 border border-outline-variant/30">
                <div
                  className="bg-emerald-500 h-full rounded-l-full relative group cursor-pointer"
                  style={{ width: "35%" }}
                  title="Stage 1: Ingestion - 100% complete"
                ></div>
                <div
                  className="bg-primary h-full relative group cursor-pointer"
                  style={{ width: "25%" }}
                  title="Stage 2: Vectorization - 80% complete"
                ></div>
                <div
                  className="bg-tertiary-container h-full relative group cursor-pointer"
                  style={{ width: "8%" }}
                  title="Stage 3: Synthesis - 30% complete"
                ></div>
                <div className="bg-surface-container h-full rounded-r-full flex-1"></div>
              </div>

              {/* Segment Markers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-2 text-xs font-label-md">
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>1. Ingestion (100% Complete)</span>
                </div>
                <div className="flex items-center gap-2 text-primary">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span>2. Vectorization (80% Running)</span>
                </div>
                <div className="flex items-center gap-2 text-tertiary">
                  <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                  <span>3. Synthesis (Queued / 30%)</span>
                </div>
              </div>
            </div>
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
                  Tracks preprint downloads, attention probe tests, and embedding injections.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label-md text-code-sm text-outline">Cadence Range:</span>
                <select className="bg-surface-container border border-outline-variant/40 rounded-lg text-xs font-label-md text-on-surface px-3 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer">
                  <option>Last 6 Months</option>
                  <option>Last 30 Days</option>
                  <option>Year to Date (2025)</option>
                  <option>All-Time Workspace History</option>
                </select>
              </div>
            </div>

            {/* Heatmap Matrix */}
            <div className="overflow-x-auto pb-2 custom-scrollbar">
              <div className="min-w-[720px] flex flex-col gap-1.5">
                <div className="flex text-[11px] font-label-md text-outline pl-8 justify-between pr-4">
                  <span>Nov</span>
                  <span>Dec</span>
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex flex-col justify-between text-[10px] font-label-md text-outline py-0.5 h-[104px]">
                    <span>Mon</span>
                    <span>Wed</span>
                    <span>Fri</span>
                  </div>
                  {/* Heatmap Grid: 26 weeks x 7 rows */}
                  <div className="grid grid-flow-col grid-rows-7 gap-1.5 flex-1">
                    {/* Generates structured matrix mirroring the exact 26 weeks */}
                    {[
                      [0, 1, 0, 2, 0, 0, 0],
                      [1, 3, 4, 0, 2, 0, 0],
                      [0, 2, 0, 1, 0, 0, 0],
                      [2, 4, 5, 3, 0, 0, 0],
                      [0, 0, 1, 2, 0, 0, 0],
                      [2, 0, 3, 4, 5, 0, 0],
                      [0, 1, 0, 0, 2, 0, 0],
                      [3, 2, 4, 0, 0, 0, 0],
                      [0, 1, 2, 3, 4, 0, 0],
                      [2, 5, 4, 3, 2, 0, 0],
                      [0, 1, 0, 2, 0, 0, 0],
                      [1, 3, 4, 5, 2, 0, 0],
                      [2, 4, 3, 0, 1, 0, 0],
                      [0, 2, 3, 4, 5, 0, 0],
                      [2, 3, 0, 1, 0, 0, 0],
                      [1, 2, 4, 5, 3, 0, 0],
                      [0, 1, 2, 0, 3, 0, 0],
                      [2, 4, 5, 3, 4, 0, 0],
                      [3, 4, 5, 2, 0, 0, 0],
                      [0, 2, 3, 4, 5, 0, 0],
                      [1, 2, 0, 3, 0, 0, 0],
                      [2, 4, 5, 3, 4, 0, 0],
                      [3, 5, 4, 2, 0, 0, 0],
                      [5, 5, 4, 3, 5, 2, 0],
                      [5, 5, 4, 5, 3, 1, 0],
                      [5, 5, 4, 0, 0, 0, 0],
                    ].map((week, wIdx) =>
                      week.map((level, dIdx) => {
                        const levelClasses = [
                          "bg-surface-container-high",
                          "bg-primary/20",
                          "bg-primary/40",
                          "bg-primary/60",
                          "bg-primary/80",
                          "bg-primary",
                        ];
                        const isCurrentWeek = wIdx === 25 && level > 0;
                        return (
                          <div
                            key={`${wIdx}-${dIdx}`}
                            className={`w-3.5 h-3.5 rounded-sm ${
                              levelClasses[level]
                            } ${isCurrentWeek ? "ring-1 ring-primary-fixed" : ""} transition-transform hover:scale-125 cursor-pointer`}
                            title={`Activity intensity: ${level}`}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Heatmap Footer with Legend & Breakdown */}
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-label-md">
                <span className="text-on-surface font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  184 Total Actions
                </span>
                <span className="text-outline">•</span>
                <span className="text-on-surface-variant">82 Papers Searched</span>
                <span className="text-outline">•</span>
                <span className="text-on-surface-variant">42 Downloaded</span>
                <span className="text-outline">•</span>
                <span className="text-on-surface-variant">60 Code / Probes</span>
                <span className="text-outline">•</span>
                <span className="text-emerald-400 font-medium">Current Streak: 12 Days</span>
                <span className="text-outline">•</span>
                <span className="text-outline">Longest Streak: 26 Days</span>
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center gap-2 text-xs font-label-md text-outline">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-surface-container-high"></div>
                <div className="w-3 h-3 rounded-sm bg-primary/20"></div>
                <div className="w-3 h-3 rounded-sm bg-primary/40"></div>
                <div className="w-3 h-3 rounded-sm bg-primary/60"></div>
                <div className="w-3 h-3 rounded-sm bg-primary"></div>
                <span>More</span>
              </div>
            </div>
          </section>

          {/* SECTION 5: TEAMMATES & COLLABORATION PANEL */}
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
          </section>
        </main>
      </div>

      {/* ========================================== */}
      {/* MODAL: INVITE TEAMMATE MODAL               */}
      {/* ========================================== */}
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
      )}
    </div>
  );
}
