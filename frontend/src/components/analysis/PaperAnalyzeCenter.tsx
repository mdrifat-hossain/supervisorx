"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import ProjectSidebar from "@/components/common/ProjectSidebar";

export interface Paper {
  id: string;
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

const INITIAL_PAPERS: Paper[] = [
  {
    id: "p1",
    title: "Attention Is All You Need",
    authors: "Vaswani, A., Shazeer, N., Parmar, N., et al.",
    venue: "NeurIPS",
    tags: ["Transformers", "NLP"],
    size: 2.1,
    sizeLabel: "2.1 MB • PDF",
    timeAgo: "2h ago",
    date: "2024-05-10",
    citations: 112400,
    status: "analyzed",
  },
  {
    id: "p2",
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    authors: "Devlin, J., Chang, M. W., Lee, K., Toutanova, K.",
    venue: "NAACL",
    tags: ["Pre-training"],
    size: 1.8,
    sizeLabel: "1.8 MB • PDF",
    timeAgo: "Yesterday",
    date: "2024-05-09",
    citations: 89200,
    status: "analyzed",
  },
  {
    id: "p3",
    title: "Deep Residual Learning for Image Recognition",
    authors: "He, K., Zhang, X., Ren, S., Sun, J.",
    venue: "CVPR IEEE",
    tags: ["ResNet", "Vision"],
    size: 4.5,
    sizeLabel: "4.5 MB • PDF",
    timeAgo: "3 days ago",
    date: "2024-05-08",
    citations: 195000,
    status: "analyzed",
  },
  {
    id: "p4",
    title: "Generative Adversarial Nets",
    authors: "Goodfellow, I., Pouget-Abadie, J., Mirza, M., et al.",
    venue: "NeurIPS",
    tags: ["GANs", "Generative"],
    size: 3.2,
    sizeLabel: "3.2 MB • PDF",
    timeAgo: "4 days ago",
    date: "2024-05-07",
    citations: 65000,
    status: "analyzed",
  },
  {
    id: "p5",
    title: "LoRA: Low-Rank Adaptation of Large Language Models",
    authors: "Hu, E. J., Shen, Y., Wallis, P., et al.",
    venue: "ICLR 2022",
    tags: ["PEFT", "Fine-tuning"],
    size: 1.4,
    sizeLabel: "1.4 MB • PDF",
    timeAgo: "4h ago",
    date: "2024-05-12",
    citations: 14300,
    status: "pending",
  },
  {
    id: "p6",
    title: "Chain-of-Thought Prompting in Language Models",
    authors: "Wei, J., Wang, X., Schuurmans, D., et al.",
    venue: "NeurIPS 2022",
    tags: ["Reasoning", "LLM"],
    size: 0.9,
    sizeLabel: "980 KB • PDF",
    timeAgo: "1h ago",
    date: "2024-05-13",
    citations: 9800,
    status: "pending",
  },
];

const INITIAL_UPLOADS: UploadTransfer[] = [
  {
    id: "u1",
    name: "Quantum_Entanglement_Paper_v2.pdf",
    sizeLabel: "14.2 MB • Research Paper • SHA-256 Validated",
    type: "paper",
    progress: 82,
    status: "active",
    subtext: "Verified integrity. Ready for automated vector indexing.",
  },
  {
    id: "u2",
    name: "raw_training_dataset_june.json",
    sizeLabel: "256.4 MB • Dataset",
    type: "dataset",
    progress: 46,
    status: "paused",
    warning: "Duplicate content detected in project 'Aura-X'",
  },
];

export default function PaperAnalyzeCenter({
  projectId = "cognitive-mapper",
}: {
  projectId?: string;
}) {
  const [activeTab, setActiveTab] = useState<"upload" | "analyze">("upload");
  const [papers, setPapers] = useState<Paper[]>(INITIAL_PAPERS);
  const [uploads, setUploads] = useState<UploadTransfer[]>(INITIAL_UPLOADS);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "analyzed" | "pending">("all");
  const [sortOption, setSortOption] = useState<"newest" | "az" | "za" | "size">("newest");

  // Dynamic AI Progress Engine State
  const [progressLevel, setProgressLevel] = useState(68);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [badgeText, setBadgeText] = useState("Analyzing 2 Selected Papers...");
  const [stepText, setStepText] = useState(
    "Current task: Vectorizing embeddings & citation cross-referencing for BERT (Devlin et al.) • "
  );
  const [etaText, setEtaText] = useState("ETA: 14s");

  // Selected paper insights modal
  const [insightsPaper, setInsightsPaper] = useState<Paper | null>(null);

  // Drag and Drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Counters
  const totalCount = papers.length;
  const analyzedCount = papers.filter((p) => p.status === "analyzed").length;
  const pendingCount = totalCount - analyzedCount;

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

  // Progress animation function
  const animateProgressTo = (targetLevel: number, onDone?: () => void) => {
    setIsAnalyzing(true);
    let current = progressLevel;
    const step = (targetLevel - current) / 20;

    const interval = setInterval(() => {
      current += step;
      if (
        (step > 0 && current >= targetLevel) ||
        (step < 0 && current <= targetLevel)
      ) {
        current = targetLevel;
        clearInterval(interval);
        setProgressLevel(targetLevel);
        setIsAnalyzing(false);
        if (onDone) onDone();
      } else {
        setProgressLevel(Math.round(current));
      }
    }, 35);
  };

  // Trigger batch analysis
  const triggerBatchAnalysis = () => {
    const targetIds =
      selectedPaperIds.length > 0
        ? selectedPaperIds
        : papers.filter((p) => p.status === "pending").map((p) => p.id);

    if (targetIds.length === 0) return;

    setBadgeText(`Synthesizing ${targetIds.length} Papers...`);
    setStepText("Extracting semantic citations & constructing high-dimensional vectors • ");
    setEtaText("ETA: 6s");

    animateProgressTo(100, () => {
      setPapers((prev) =>
        prev.map((p) => (targetIds.includes(p.id) ? { ...p, status: "analyzed" } : p))
      );
      setBadgeText("All Selected Analyzed & Synced");
      setStepText("✓ Knowledge graph synthesis completed. Papers fully indexed.");
      setEtaText("");
    });
  };

  // Analyze single paper
  const analyzeSinglePaper = (id: string) => {
    const paper = papers.find((p) => p.id === id);
    if (!paper) return;

    setBadgeText(`Analyzing ${paper.title.slice(0, 24)}...`);
    setStepText(`Constructing citation cross-references for ${paper.title.slice(0, 20)} • `);
    setEtaText("ETA: 4s");

    const nextTarget = Math.min(progressLevel + 16, 100);
    animateProgressTo(nextTarget, () => {
      setPapers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "analyzed" } : p))
      );
      setBadgeText(`${paper.title.slice(0, 20)}... Analyzed`);
      setStepText("✓ Paper semantic graph vector index verified.");
      setEtaText("");
    });
  };

  // Delete papers
  const deleteSinglePaper = (id: string) => {
    setPapers((prev) => prev.filter((p) => p.id !== id));
    setSelectedPaperIds((prev) => prev.filter((item) => item !== id));
  };

  const batchDeleteSelected = () => {
    setPapers((prev) => prev.filter((p) => !selectedPaperIds.includes(p.id)));
    setSelectedPaperIds([]);
  };

  // Upload actions
  const uploadFiles = async (files: File[]) => {
    for (const file of files) {
      const uploadId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
        setUploads((prev) => [{
          id: uploadId,
          name: file.name,
          sizeLabel: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          type: "file",
          progress: 0,
          status: "paused",
          warning: "Only PDF files are accepted.",
        }, ...prev]);
        continue;
      }
      if (file.size === 0 || file.size > 15 * 1024 * 1024) {
        setUploads((prev) => [{
          id: uploadId,
          name: file.name,
          sizeLabel: `${(file.size / (1024 * 1024)).toFixed(1)} MB • PDF`,
          type: "file",
          progress: 0,
          status: "paused",
          warning: "PDF files must be 15 MB or smaller.",
        }, ...prev]);
        continue;
      }

      const transfer: UploadTransfer = {
        id: uploadId,
        name: file.name,
        sizeLabel: `${(file.size / (1024 * 1024)).toFixed(1)} MB • PDF`,
        type: "file",
        progress: 25,
        status: "active",
        subtext: "Uploading to private project storage…",
      };
      setUploads((prev) => [transfer, ...prev]);
      try {
        const body = new FormData();
        body.set("file", file);
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/papers/upload`, {
          method: "POST",
          body,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Upload failed");
        setUploads((prev) => prev.map((item) => item.id === uploadId
          ? { ...item, progress: 100, status: "completed", subtext: "Stored in private project storage." }
          : item));
      } catch (error) {
        setUploads((prev) => prev.map((item) => item.id === uploadId
          ? { ...item, progress: 0, status: "paused", warning: error instanceof Error ? error.message : "Upload failed." }
          : item));
      }
    }
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void uploadFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="bg-background text-on-surface font-body-md text-body-md antialiased min-h-screen flex selection:bg-primary-container selection:text-on-primary-container">
      {/* ========================================== */}
      {/* 1. LEFT SIDEBAR (Common ProjectSidebar)    */}
      {/* ========================================== */}
      <ProjectSidebar activeTab="analysis" projectId={projectId} />

      {/* ========================================== */}
      {/* 2. MAIN RESEARCH WORKSPACE AREA            */}
      {/* ========================================== */}
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
                Cognitive Mapper v4
              </Link>
              <span className="text-outline">/</span>
              <span className="text-on-surface font-semibold">Upload &amp; Analysis</span>
            </div>
          </div>

          <div className="flex items-center gap-md">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
                search
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-surface-container-high border border-outline-variant/40 rounded-lg text-xs font-label-md text-on-surface focus:outline-none focus:border-primary w-48 lg:w-64 transition-all"
                placeholder="Quick search (Cmd+K)..."
                type="text"
              />
            </div>
            <button
              className="p-2 text-on-surface-variant hover:text-primary transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-lg">notifications</span>
              <span className="w-2 h-2 rounded-full bg-primary absolute top-1.5 right-1.5"></span>
            </button>
            <div className="flex items-center gap-sm pl-md border-l border-outline-variant/30">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-container to-tertiary-container flex items-center justify-center text-xs font-bold text-on-primary-container shadow-sm border border-primary/30">
                DR
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-medium text-on-surface leading-tight font-label-md">
                  Dr. Researcher
                </span>
                <span className="text-[10px] text-on-surface-variant font-code-sm">
                  Senior Research Fellow
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ========================================== */}
        {/* MAIN CONTAINER                             */}
        {/* ========================================== */}
        <main className="flex-grow py-6 px-6 lg:px-10 max-w-7xl w-full flex flex-col gap-lg mx-auto">
        {/* Primary Navigation Tabs & Global Status */}
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
              <span>Cloud Sync: Healthy</span>
            </span>
          </div>
        </div>

        {/* ========================================== */}
        {/* TAB 1: UPLOAD SECTION                      */}
        {/* ========================================== */}
        {activeTab === "upload" && (
          <div className="workspace-tab-panel flex flex-col space-y-gutter w-full">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
              <div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                  Research Upload Center
                </h1>
                <p className="text-on-surface-variant mt-xs max-w-[700px]">
                  Integrate research papers, model architectures, and structured benchmark
                  datasets into your SupervisorX workspace.
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

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {/* Full-width Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDropFiles}
              onClick={() => fileInputRef.current?.click()}
              className={`glass-panel rounded-xl p-2xl border-2 border-dashed transition-all duration-500 group relative overflow-hidden text-center cursor-pointer ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant/50 hover:border-primary/50"
              }`}
            >
              <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-tertiary/5 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="relative flex flex-col items-center justify-center space-y-6 py-8 w-full max-w-[680px] mx-auto text-center">
                <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center ink-shadow group-hover:scale-110 transition-transform duration-500 border border-outline-variant/30">
                  <span
                    className="material-symbols-outlined text-4xl text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    upload_file
                  </span>
                </div>
                <div>
                  <h2 className="font-headline-md text-2xl font-bold text-on-surface mb-2">
                    Drag and drop research papers
                  </h2>
                  <p className="text-on-surface-variant text-body-md text-sm sm:text-base leading-relaxed max-w-[580px] mx-auto">
                    Accepts PDF (Max 15 MB each)
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    type="button"
                    className="px-6 py-3 bg-primary text-on-primary hover:bg-primary-fixed-dim rounded-xl font-label-md text-sm font-semibold transition-all active:scale-[0.98] shadow-md shadow-primary/20 flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">folder_open</span>
                    <span>Browse Files</span>
                  </button>
                  <button
                    disabled
                    type="button"
                    className="px-5 py-3 bg-surface-container-high/40 border border-outline-variant/30 text-outline rounded-xl font-label-md text-xs sm:text-sm font-medium flex items-center gap-2 cursor-not-allowed opacity-50 select-none"
                    title="GitHub connection temporarily disabled"
                  >
                    <span className="material-symbols-outlined text-[18px]">link</span>
                    <span>Connect GitHub (Disabled)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Active Uploads List */}
            <div className="space-y-md">
              <div className="flex items-center justify-between">
                <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">
                  Active Transfers &amp; Verification
                </h3>
                <span className="font-code-sm text-code-sm text-primary">
                  {uploads.length} items in progress
                </span>
              </div>

              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className={`glass-panel p-md rounded-lg flex flex-col gap-sm ink-shadow ${
                    upload.status === "paused" ? "border border-error/20" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-md">
                      <div
                        className={`w-10 h-10 bg-surface-container-highest rounded-lg flex items-center justify-center ${
                          upload.type === "dataset" ? "text-secondary" : "text-tertiary"
                        }`}
                      >
                        <span className="material-symbols-outlined">
                          {upload.type === "dataset" ? "data_object" : "description"}
                        </span>
                      </div>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface">
                          {upload.name}
                        </div>
                        <div className="font-code-sm text-code-sm text-on-surface-variant">
                          {upload.sizeLabel}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-md">
                      <span
                        className={`font-code-sm text-code-sm ${
                          upload.status === "paused" ? "text-error" : "text-primary"
                        }`}
                      >
                        {upload.status === "paused" ? "Paused" : `${upload.progress}%`}
                      </span>
                      <button
                        onClick={() => removeUpload(upload.id)}
                        className="text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  </div>

                  <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        upload.status === "paused" ? "bg-error" : "bg-primary"
                      }`}
                      style={{ width: `${upload.progress}%` }}
                    ></div>
                  </div>

                  {upload.subtext && (
                    <div className="flex items-center gap-sm">
                      <span className="material-symbols-outlined text-sm text-emerald-400">
                        check_circle
                      </span>
                      <span className="font-code-sm text-code-sm text-secondary">
                        {upload.subtext}
                      </span>
                    </div>
                  )}

                  {upload.warning && (
                    <div className="flex items-center justify-between bg-error-container/20 p-sm rounded border border-error/10">
                      <div className="flex items-center gap-sm">
                        <span className="material-symbols-outlined text-sm text-error">
                          warning
                        </span>
                        <span className="font-code-sm text-code-sm text-error">
                          {upload.warning}
                        </span>
                      </div>
                      <button
                        onClick={() => removeUpload(upload.id)}
                        className="font-code-sm text-code-sm text-error underline underline-offset-2 cursor-pointer"
                      >
                        Replace Existing
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: PAPER ANALYZE SECTION               */}
        {/* ========================================== */}
        {activeTab === "analyze" && (
          <div className="workspace-tab-panel flex flex-col space-y-gutter w-full">
            {/* Header & Summary Metrics */}
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
                  <span className="text-on-surface-variant">Pending:</span>
                  <span className="font-bold text-amber-400">{pendingCount}</span>
                </div>
              </div>
            </div>

            {/* Prominent Dynamic AI Analysis Engine Progress Bar Card */}
            <div className="glass-panel p-lg rounded-xl border border-primary/35 relative overflow-hidden ink-shadow bg-surface-container-low">
              <div className="absolute -right-20 -top-20 w-56 h-56 bg-primary/10 blur-[90px] rounded-full pointer-events-none"></div>
              <div className="absolute -left-20 -bottom-20 w-56 h-56 bg-tertiary/10 blur-[90px] rounded-full pointer-events-none"></div>
              <div className="flex flex-col gap-md relative z-10">
                {/* Top Row: Title, Glowing Badge, Live Metrics */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(77,142,255,0.25)]">
                      <span
                        className={`material-symbols-outlined text-xl text-primary ${
                          isAnalyzing ? "animate-spin" : ""
                        }`}
                        style={{ animationDuration: "6s" }}
                      >
                        autorenew
                      </span>
                    </div>
                    <div>
                      <div className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-2 flex-wrap">
                        <span className="text-base text-on-surface font-bold">
                          Active AI Analysis Engine
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-code-sm bg-primary/15 text-primary border border-primary/30 shadow-[0_0_10px_rgba(173,198,255,0.2)]">
                          <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                          <span>{badgeText}</span>
                        </span>
                      </div>
                      <div className="font-code-sm text-code-sm text-on-surface-variant mt-0.5">
                        <span>
                          {analyzedCount} of {totalCount} Papers Fully Indexed &amp; Analyzed
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-baseline sm:text-right gap-2 sm:flex-col sm:gap-0">
                    <span className="font-code-sm text-headline-lg text-primary font-bold tracking-tight drop-shadow-[0_0_12px_rgba(77,142,255,0.4)]">
                      {progressLevel}%
                    </span>
                    <span className="font-code-sm text-[11px] text-on-surface-variant">
                      Completed
                    </span>
                  </div>
                </div>

                {/* Progress Bar: Sleek Illuminated Gradient with shimmer */}
                <div className="relative w-full bg-surface-container-highest/80 h-3.5 rounded-full overflow-hidden p-0.5 border border-outline-variant/40 shadow-inner">
                  <div
                    className="relative h-full bg-gradient-to-r from-blue-600 via-primary-container to-tertiary-container rounded-full transition-all duration-700 ease-out shadow-[0_0_18px_#4d8eff] overflow-hidden"
                    style={{ width: `${progressLevel}%` }}
                  >
                    <div className="absolute inset-0 animate-shimmer"></div>
                  </div>
                </div>

                {/* Bottom Row: Current Processing Phase Details & ETA */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-code-sm text-on-surface-variant gap-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-primary">
                      auto_awesome
                    </span>
                    <span className="text-xs">
                      {stepText}
                      {etaText && (
                        <span className="text-primary font-medium">{etaText}</span>
                      )}
                    </span>
                  </div>
                  <div className="text-[11px] font-code-sm text-outline flex items-center gap-1.5 self-end sm:self-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Cognitive Graph Sync: 480 nodes/sec</span>
                  </div>
                </div>
              </div>
            </div>

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
                  className="px-md py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-xs sm:text-label-md font-bold flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                  <span>Analyze Selected</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-on-primary/20 text-on-primary ml-1">
                    {selectedPaperIds.length}
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
                    placeholder="Search downloaded papers by title, author, keyword..."
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
                    {filteredPapers.map((paper) => {
                      const isChecked = selectedPaperIds.includes(paper.id);
                      return (
                        <tr
                          key={paper.id}
                          className="paper-row hover:bg-surface-container-high/40 transition-colors"
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
                                  paper.status === "analyzed"
                                    ? "bg-primary/10 border-primary/20 text-primary"
                                    : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                }`}
                              >
                                <span className="material-symbols-outlined text-lg">
                                  article
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
                            {paper.status === "analyzed" ? (
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
                                  className="px-2.5 py-1 rounded text-[11px] font-code-sm bg-primary text-on-primary font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-xs">
                                    auto_awesome
                                  </span>
                                  <span>Analyze Now</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  alert(`Downloading PDF for ${paper.title}...`);
                                }}
                                className="p-1.5 text-on-surface-variant hover:text-primary rounded hover:bg-surface-variant/40 transition-colors cursor-pointer"
                                title="Download PDF"
                              >
                                <span className="material-symbols-outlined text-base">
                                  download
                                </span>
                              </button>
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

                    {filteredPapers.length === 0 && (
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

      {/* ========================================== */}
      {/* INSIGHTS SUMMARY MODAL                     */}
      {/* ========================================== */}
      {insightsPaper && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setInsightsPaper(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        >
          <div className="w-full max-w-[680px] rounded-2xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-5">
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
              <div>
                <h4 className="text-on-surface font-semibold uppercase tracking-wider font-code-sm text-[11px] mb-1">
                  Key Methodological Insights
                </h4>
                <p className="bg-surface-container p-3 rounded-lg border border-outline-variant/30 text-on-surface leading-relaxed">
                  Demonstrates scalable attention architecture with bounded entropy decay.
                  Multi-head attention projections maintain orthogonality under high-dimensional
                  embeddings, directly preventing gradient starvation across deep layers.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/30">
                  <span className="text-outline text-[10px] font-code-sm uppercase block">
                    Citations
                  </span>
                  <span className="text-base font-bold text-primary font-code-sm">
                    {insightsPaper.citations.toLocaleString()}
                  </span>
                </div>
                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/30">
                  <span className="text-outline text-[10px] font-code-sm uppercase block">
                    Vector Dimension
                  </span>
                  <span className="text-base font-bold text-tertiary font-code-sm">
                    1536-D
                  </span>
                </div>
                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/30">
                  <span className="text-outline text-[10px] font-code-sm uppercase block">
                    Graph Nodes
                  </span>
                  <span className="text-base font-bold text-emerald-400 font-code-sm">
                    48 Connected
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-on-surface font-semibold uppercase tracking-wider font-code-sm text-[11px] mb-1">
                  Extracted Topic Clusters
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
                    #VectorIndex
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/30 font-code-sm text-xs">
                    #GroundedSynthesis
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
              <Link
                href={`/projects/${projectId}/chatbot`}
                className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary border border-primary/30 text-xs font-label-md transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                <span>Ask Chatbot About This Paper</span>
              </Link>
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

      {/* ========================================== */}
      {/* Footer (Shared Component Execution)        */}
      {/* ========================================== */}
      <footer className="w-full py-2xl border-t border-outline-variant/20 bg-surface-container-lowest mt-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-lg px-lg max-w-container-max mx-auto">
          <div className="lg:col-span-2">
            <span className="font-headline-md text-headline-md font-bold text-primary block mb-md">
              SupervisorX
            </span>
            <p className="text-on-surface-variant font-body-md text-body-md">
              Empowering the next generation of researchers with technical cognitive clarity and
              AI-driven synthesis.
            </p>
          </div>
          <div className="flex flex-col gap-sm">
            <span className="font-label-md text-label-md text-on-surface font-bold">
              Resources
            </span>
            <a
              className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-all duration-300"
              href="#docs"
            >
              Documentation
            </a>
            <a
              className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-all duration-300"
              href="#api"
            >
              API
            </a>
            <a
              className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-all duration-300"
              href="#status"
            >
              Status
            </a>
          </div>
          <div className="flex flex-col gap-sm">
            <span className="font-label-md text-label-md text-on-surface font-bold">
              Legal
            </span>
            <a
              className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-all duration-300"
              href="#privacy"
            >
              Privacy Policy
            </a>
            <a
              className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-all duration-300"
              href="#terms"
            >
              Terms of Service
            </a>
          </div>
          <div className="flex flex-col gap-sm lg:col-span-2 items-end justify-end">
            <p className="text-on-surface-variant font-label-md text-label-md text-right">
              © 2024 SupervisorX AI Research. All rights reserved.
            </p>
            <div className="flex gap-md mt-sm">
              <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors">
                language
              </span>
              <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors">
                terminal
              </span>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
