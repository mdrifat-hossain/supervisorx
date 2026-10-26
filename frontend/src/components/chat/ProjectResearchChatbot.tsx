"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import ProjectSidebar from "@/components/common/ProjectSidebar";
import FormattedResearchMarkdown from "./FormattedResearchMarkdown";

type ChatTaskMode = "search" | "download" | "document" | "summary" | "comparison" | "question" | "chat";

function classifyChatTask(message: string): ChatTaskMode {
  const text = message.toLowerCase().trim();
  const paperDownload = /\b(?:download|save)\b.{0,60}\b(?:papers?|preprints?|articles?)\b/.test(text);
  if (paperDownload) return "download";

  const outputAction = /\b(?:create|generate|make|export|save|provide|give|send|turn|convert|download)\b/.test(text);
  const fileTarget = /\b(?:pdf|docx?|word\s+(?:doc|document|file)|file|document|report)\b/.test(text);
  if ((outputAction && fileTarget) || /\bexport\s+(?:this|the|my|your|previous)\b/.test(text)) {
    return "document";
  }

  const discoveryLead = /^(?:(?:can|could|would) you\s+|please\s+|i (?:want|need) to\s+|help me\s+)?(?:find|search(?:\s+for)?|look\s+for|discover|recommend|list|show(?:\s+me)?|bring\s+me|get\s+me|fetch|retrieve)\b/.test(text);
  const discoveryTarget = /\b(?:papers?|preprints?|studies|articles|literature|publications)\b/.test(text);
  const refersToProjectLibrary = /\b(?:analyzed|uploaded|selected|these|this paper|the paper|project library)\b/.test(text);
  const bringRecentPapers = /^(?:give|get|bring) me\s+(?:\d+\s+)?(?:(?:recent|new|top|relevant)\s+)?papers?\b/.test(text);
  if ((discoveryLead && discoveryTarget && !refersToProjectLibrary) || bringRecentPapers) return "search";

  if (/\b(?:compare|comparison|contrast|versus|vs)\b/.test(text)) return "comparison";
  if (/\b(?:summary|summarize|summarise|summarizing|summarising|overview|walkthrough)\b/.test(text)) return "summary";
  if (/^(?:what|why|how|who|when|where|which|explain|describe|analyze|analyse|evaluate|does|is|are|can you explain)\b/.test(text) || text.includes("?")) {
    return "question";
  }
  if (/\b(?:paper|papers|research|finding|findings|result|results|method|methods|methodology|objective|objectives)\b/.test(text)) return "question";
  return "chat";
}

function getRequestedDocumentFormats(message: string): Array<"PDF" | "DOCX"> {
  const text = message.toLowerCase();
  const formats: Array<"PDF" | "DOCX"> = [];
  if (/\bpdf\b/.test(text)) formats.push("PDF");
  if (/\b(?:docx?|word(?:\s+(?:doc|document|file))?)\b/.test(text)) formats.push("DOCX");
  return formats.length ? formats : ["PDF"];
}

interface Citation {
  citation_index: number;
  paper_id: string;
  paper_title: string;
  authors: string;
  year?: number;
  section_title: string;
  page_start?: number;
  page_end?: number;
  page_label: string;
  claim_supported: string;
  pdf_url?: string;
  is_visual?: boolean;
  figure_number?: string;
}

interface Session {
  id: string;
  title: string;
  paperCount: number;
  timeLabel: string;
  isActive: boolean;
}

interface PaperItem {
  id: number;
  paperId?: string;
  title: string;
  venue: string;
  venueType: "arxiv" | "conference" | "journal";
  authors: string;
  tag?: string;
  snippet: string;
  status: "downloaded" | "available" | "downloading" | "failed";
  progress?: number;
  pdfUrl?: string;
  entryUrl?: string;
  published?: string;
  year?: number;
  relevanceScore?: number;
  relevanceReason?: string;
  matchedCriteria?: string[];
}

const INITIAL_SESSIONS: Session[] = [
  {
    id: "session-1",
    title: "Sparse Attention & Entropy Decay",
    paperCount: 12,
    timeLabel: "Active",
    isActive: true,
  },
  {
    id: "session-2",
    title: "Transformer Quantization Latency",
    paperCount: 8,
    timeLabel: "3 days ago",
    isActive: false,
  },
  {
    id: "session-3",
    title: "Cross-Species Gene Transformer Benchmarks",
    paperCount: 15,
    timeLabel: "Oct 18",
    isActive: false,
  },
  {
    id: "session-4",
    title: "Shadow Gradient Vanishing in LayerNorm",
    paperCount: 6,
    timeLabel: "Oct 12",
    isActive: false,
  },
];

const INITIAL_PAPERS: PaperItem[] = [
  {
    id: 1,
    paperId: "2403.1192",
    title: "Entropy-Constrained Sparse Attention in 70B Parameter LLMs",
    venue: "ArXiv:2403.1192",
    venueType: "arxiv",
    authors: "Vaswani et al., 2024",
    tag: "PyTorch Code Included",
    snippet:
      '"We demonstrate an analytical bound on entropy collapse during multi-head pruning across 70B checkpoints..."',
    status: "downloaded",
    pdfUrl: "https://arxiv.org/pdf/2403.1192.pdf",
    entryUrl: "https://arxiv.org/abs/2403.1192",
  },
  {
    id: 2,
    paperId: "2401.08828",
    title: "Dynamic Routing of Attention Heads via Top-k Gumbel Softmax",
    venue: "ICLR 2024",
    venueType: "conference",
    authors: "Zhang, Lin, Bengio, 2024 • Citation Count: 48",
    snippet:
      '"Proposes dynamic routing to mitigate representational collapse and gradient starvation during sparse passes..."',
    status: "available",
    pdfUrl: "https://arxiv.org/pdf/2401.08828.pdf",
    entryUrl: "https://arxiv.org/abs/2401.08828",
  },
  {
    id: 3,
    paperId: "2309.17453",
    title: "Gradient Starvation and Latent Space Degeneracy in Deep Transformers",
    venue: "NeurIPS 2023",
    venueType: "conference",
    authors: "Chen & Thorne, 2023 • Benchmark Repo: github.com/deep-trans/grad-starv",
    snippet:
      '"Investigating singular value decomposition of attention weights across layers 12-24 under extreme sparsification..."',
    status: "available",
    pdfUrl: "https://arxiv.org/pdf/2309.17453.pdf",
    entryUrl: "https://arxiv.org/abs/2309.17453",
  },
  {
    id: 4,
    paperId: "2401.0882",
    title: "Sparse Sinkhorn Attention: Preserving Mutual Information",
    venue: "ArXiv:2401.0882",
    venueType: "arxiv",
    authors: "Al-Mansoor et al., 2024 • Optimal Transport Solvers",
    snippet:
      '"Utilizing entropic regularized Sinkhorn iterations to enforce maximal row-wise entropy distributions..."',
    status: "downloading",
    progress: 72,
    pdfUrl: "https://arxiv.org/pdf/2401.0882.pdf",
    entryUrl: "https://arxiv.org/abs/2401.0882",
  },
  {
    id: 5,
    paperId: "2305.18290",
    title: "Empirical Study of LayerNorm Entropy Trajectories",
    venue: "ICML",
    venueType: "arxiv",
    authors: "Dupont & Klein, 2023 • Gateway Timeout (504) on Institutional Host",
    snippet:
      '"Measuring entropy fluctuations post RMSNorm versus classical LayerNorm under zero-shot validation..."',
    status: "failed",
    pdfUrl: "https://arxiv.org/pdf/2305.18290.pdf",
    entryUrl: "https://arxiv.org/abs/2305.18290",
  },
  {
    id: 6,
    paperId: "2309.17453",
    title: "Attention Sink Phenomena in Quantized Language Models",
    venue: "ArXiv:2309.17453",
    venueType: "arxiv",
    authors: "Xiao, Tian et al., 2024 • Code: streaming-llm",
    snippet:
      '"Preserving initial token attention values restores massive loss spikes in 4-bit and 8-bit sparse quantization."',
    status: "available",
    pdfUrl: "https://arxiv.org/pdf/2309.17453.pdf",
    entryUrl: "https://arxiv.org/abs/2309.17453",
  },
  {
    id: 7,
    paperId: "2402.0451",
    title: "Orthogonal Attention Projection for Long-Context Fidelity",
    venue: "ACL 2024",
    venueType: "conference",
    authors: "R. Patel, K. Murthy, 2024 • Context Window: 128k",
    snippet:
      '"Orthogonality constraints prevent attention matrix rank collapse when context lengths surpass 64k tokens."',
    status: "available",
    pdfUrl: "https://arxiv.org/pdf/2402.0451.pdf",
    entryUrl: "https://arxiv.org/abs/2402.0451",
  },
  {
    id: 8,
    paperId: "2301.00774",
    title: "Spectral Norm Regularization of Multi-Head Self-Attention",
    venue: "JMLR 2023",
    venueType: "journal",
    authors: "Foster & Wu, 2023 • Theoretical Bounds",
    snippet:
      '"Proving Lipschitz continuity bounds on self-attention outputs under induced matrix spectral norm penalties..."',
    status: "available",
    pdfUrl: "https://arxiv.org/pdf/2301.00774.pdf",
    entryUrl: "https://arxiv.org/abs/2301.00774",
  },
  {
    id: 9,
    paperId: "2402.01234",
    title: "Cross-Layer Attention Redistribution under Extreme Sparsity",
    venue: "EMNLP 2024",
    venueType: "conference",
    authors: "Morozov et al., 2024 • 90% Sparsity Regime",
    snippet:
      '"Re-allocating discarded head capacities to lower-order feature layers maintains benchmark perplexity."',
    status: "available",
    pdfUrl: "https://arxiv.org/pdf/2402.01234.pdf",
    entryUrl: "https://arxiv.org/abs/2402.01234",
  },
  {
    id: 10,
    paperId: "2402.0451",
    title: "Attention Head Redundancy and Pruning Dynamics",
    venue: "ArXiv:2402.0451",
    venueType: "arxiv",
    authors: "S. Gupta et al., 2024 • Multi-GPU Pruning Tool",
    snippet:
      '"Analyzing the cosine similarity of head projection matrices to identify deterministic pruning candidates..."',
    status: "available",
    pdfUrl: "https://arxiv.org/pdf/2402.0451.pdf",
    entryUrl: "https://arxiv.org/abs/2402.0451",
  },
];

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text?: string;
  time: string;
  tag?: string;
  isPapersResponse?: boolean;
  papers?: PaperItem[];
  introText?: string;
  totalVerified?: number;
  citations?: Citation[];
  intent?: string;
  queuedInfo?: {
    count: number;
    total: number;
    paperIds: number[];
    titles?: string[];
  };
  document?: {
    id: string;
    document_id?: string;
    title: string;
    document_type: string;
    format: "pdf" | "docx" | "both";
    formats_available: string[];
    filename_pdf?: string;
    filename_docx?: string;
    file_size_bytes?: number;
    generated_at: string;
    scope_description?: string;
    download_url_pdf?: string;
    download_url_docx?: string;
    sections_count?: number;
    citations_count?: number;
    sources_count?: number;
  };
}

export default function ProjectResearchChatbot({
  projectId = "cognitive-mapper",
  projectName: initialProjectName,
}: {
  projectId?: string;
  projectName?: string;
}) {
  // Navigation active tab
  const [activeTab] = useState<"dashboard" | "chatbot">("chatbot");

  // History Drawer state
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");
  const [, setIsLoadingHistory] = useState(true);

  // Rename modal state
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  const [renameInputTitle, setRenameInputTitle] = useState("");

  // Source filters - verified supported literature sources
  const [isSourcesMenuOpen, setIsSourcesMenuOpen] = useState(false);
  const [sources, setSources] = useState([
    { id: "arxiv", name: "arXiv", sub: "Preprints & CS / Math / AI", checked: true },
    { id: "openalex", name: "OpenAlex", sub: "Global Open Access Works", checked: true },
  ]);

  // Limits dropdown
  const [isLimitMenuOpen, setIsLimitMenuOpen] = useState(false);
  const [paperLimit, setPaperLimit] = useState(10);
  const [customLimitInput, setCustomLimitInput] = useState("10");

  // Year Range dropdown (Default: 2023 - 2026)
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);
  const [startYear, setStartYear] = useState(2023);
  const [endYear, setEndYear] = useState(2026);
  const [startYearInput, setStartYearInput] = useState("2023");
  const [endYearInput, setEndYearInput] = useState("2026");

  // Papers state (empty by default for new projects; populated from active chat)
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);

  // Messages state (empty by default for new projects; loaded from PostgreSQL)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expandedReferenceMessages, setExpandedReferenceMessages] = useState<Record<string, boolean>>({});

  // Input state
  const [inputMessage, setInputMessage] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea smoothly as content wraps or user inputs newlines
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const minHeight = 24; // 1-line standard height
    const maxHeight = 200; // expands upwards up to ~8 lines
    const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);
  const allSessionScreenedIds = useRef<Set<string>>(new Set());
  const [activeTaskMode, setActiveTaskMode] = useState<ChatTaskMode | null>(null);
  const isSearching = activeTaskMode === "search";
  const isDownloading = activeTaskMode === "download";
  const isGeneratingDoc = activeTaskMode === "document";
  const isSynthesizing = activeTaskMode === "summary" || activeTaskMode === "comparison" || activeTaskMode === "question" || activeTaskMode === "chat";
  const [searchStage, setSearchStage] = useState(0);

  // The backend does not stream internal progress, so these are rotating task-specific status cues.
  useEffect(() => {
    if (!isSearching && !isDownloading) return;
    const interval = setInterval(() => {
      setSearchStage((prev) => (prev + 1) % 4);
    }, 2600);
    return () => clearInterval(interval);
  }, [isSearching, isDownloading]);

  const [synthesizingStage, setSynthesizingStage] = useState(0);
  const [activeThinkingQuery, setActiveThinkingQuery] = useState("");

  // Rotate descriptive status cues while the analysis request is in flight.
  useEffect(() => {
    if (!isSynthesizing) return;
    const interval = setInterval(() => {
      setSynthesizingStage((prev) => (prev + 1) % 4);
    }, 2400);
    return () => clearInterval(interval);
  }, [isSynthesizing]);

  const SEARCH_STAGES = useMemo(() => {
    const active = sources.filter((s) => s.checked).map((s) => s.name);
    const activeText = active.length > 0 ? active.join(" & ") : "arXiv & OpenAlex";
    return [
      {
        title: "Formulating targeted academic search queries...",
        subtitle: `Extracting core scientific problem statements, keywords, and ${activeText} query syntax.`,
        icon: "radar",
        badge: "Stage 1/4: Query Formulation",
      },
      {
        title: `Scanning live preprint repositories from ${activeText}...`,
        subtitle: `Querying active repository nodes (${activeText}) to collect candidate research preprints.`,
        icon: "travel_explore",
        badge: "Stage 2/4: Candidate Discovery",
      },
      {
        title: "Reading & screening candidate abstracts with AI...",
        subtitle: "Inspecting research questions, methodologies, benchmarks, and contributions in each abstract.",
        icon: "auto_stories",
        badge: "Stage 3/4: Abstract Screening",
      },
      {
        title: "Scoring, filtering & ranking top relevant literature...",
        subtitle: "Applying strict 1–10 relevance threshold, rejecting weak keyword overlaps, and compiling evidence.",
        icon: "verified",
        badge: "Stage 4/4: Relevance Ranking",
      },
    ];
  }, [sources]);

  const [docStage, setDocStage] = useState(0);

  // Rotate document-specific status cues while a file request is in flight.
  useEffect(() => {
    if (!isGeneratingDoc) return;
    const interval = setInterval(() => {
      setDocStage((prev) => (prev + 1) % 4);
    }, 2400);
    return () => clearInterval(interval);
  }, [isGeneratingDoc]);

  const requestedDocumentFormats = getRequestedDocumentFormats(activeThinkingQuery);
  const requestedDocumentFormatsLabel = requestedDocumentFormats.join(" + ");
  const documentTaskKind = /\b(?:summary|summarize|summarise|summarizing|summarising|overview|walkthrough)\b/i.test(activeThinkingQuery)
    ? "summary"
    : /\b(?:compare|comparison|contrast)\b/i.test(activeThinkingQuery)
      ? "comparison"
      : "export";
  const DOC_STAGES = (() => {
    const outputLabel = requestedDocumentFormatsLabel || "requested file";
    if (documentTaskKind === "summary") {
      return [
        { title: "Selecting analyzed papers for the summary...", subtitle: "Using the papers and scope named in your request.", icon: "library_books", badge: "Summary · Paper selection" },
        { title: "Gathering evidence from each paper...", subtitle: "Collecting problem, methods, experiments, results, and limitations with page references.", icon: "manage_search", badge: "Summary · Source review" },
        { title: "Organizing the paper-by-paper report...", subtitle: "Structuring findings and linking each claim to its cited source section.", icon: "format_list_numbered", badge: "Summary · Report structure" },
        { title: `Preparing your ${outputLabel} summary...`, subtitle: "Finishing the requested file and its source references.", icon: "description", badge: `Output · ${outputLabel}` },
      ];
    }
    if (documentTaskKind === "comparison") {
      return [
        { title: "Selecting papers for comparison...", subtitle: "Identifying the analyzed papers named in your request.", icon: "library_books", badge: "Comparison · Paper selection" },
        { title: "Reviewing comparable methods and results...", subtitle: "Gathering evidence from matching sections and PDF pages.", icon: "compare_arrows", badge: "Comparison · Evidence review" },
        { title: "Structuring the comparison and references...", subtitle: "Aligning findings while keeping each source traceable.", icon: "table_chart", badge: "Comparison · Report structure" },
        { title: `Preparing your ${outputLabel} comparison...`, subtitle: "Finishing the requested file and its source references.", icon: "description", badge: `Output · ${outputLabel}` },
      ];
    }
    return [
      { title: "Collecting the answer and its citations...", subtitle: "Preserving the requested conversation content and its source anchors.", icon: "chat", badge: "Export · Content" },
      { title: "Organizing the report sections...", subtitle: "Formatting headings, tables, and references for the document.", icon: "format_list_bulleted", badge: "Export · Structure" },
      { title: `Compiling ${outputLabel}...`, subtitle: "Creating only the file format or formats requested.", icon: "description", badge: `Export · ${outputLabel}` },
      { title: "Preparing your download...", subtitle: "Finalizing the generated document link.", icon: "download_done", badge: "Export · Ready" },
    ];
  })();

  const QA_STAGES = (() => {
    if (activeTaskMode === "summary") {
      return [
        { title: "Selecting the paper or papers to summarize...", subtitle: "Checking which analyzed papers match your requested scope.", icon: "library_books", badge: "Summary · Scope" },
        { title: "Reviewing evidence across each paper...", subtitle: "Looking for objectives, methods, experiments, findings, and limitations.", icon: "manage_search", badge: "Summary · Evidence" },
        { title: "Writing the structured summary...", subtitle: "Keeping each paper separate and grounding claims in the source text.", icon: "summarize", badge: "Summary · Synthesis" },
        { title: "Adding section and page references...", subtitle: "Connecting the summary to the relevant analyzed PDF locations.", icon: "format_quote", badge: "Summary · References" },
      ];
    }
    if (activeTaskMode === "comparison") {
      return [
        { title: "Identifying papers to compare...", subtitle: "Resolving the papers and comparison dimensions in your request.", icon: "library_books", badge: "Comparison · Scope" },
        { title: "Reviewing matching evidence...", subtitle: "Gathering comparable methods, datasets, results, and limitations.", icon: "manage_search", badge: "Comparison · Evidence" },
        { title: "Comparing the findings...", subtitle: "Separating each paper’s reported results and supported conclusions.", icon: "compare_arrows", badge: "Comparison · Synthesis" },
        { title: "Adding source references...", subtitle: "Linking comparison points to paper sections and PDF pages.", icon: "format_quote", badge: "Comparison · References" },
      ];
    }
    if (activeTaskMode === "chat") {
      return [
        { title: "Preparing a response...", subtitle: "Putting together a clear reply.", icon: "chat", badge: "Reply · In progress" },
        { title: "Preparing a response...", subtitle: "Putting together a clear reply.", icon: "chat", badge: "Reply · In progress" },
        { title: "Preparing a response...", subtitle: "Putting together a clear reply.", icon: "chat", badge: "Reply · In progress" },
        { title: "Preparing a response...", subtitle: "Putting together a clear reply.", icon: "chat", badge: "Reply · In progress" },
      ];
    }
    return [
      { title: "Finding relevant sections in analyzed papers...", subtitle: "Looking for source material that addresses your question.", icon: "manage_search", badge: "Question · Find evidence" },
      { title: "Reviewing the source passages...", subtitle: "Checking the relevant paper sections and reported details.", icon: "menu_book", badge: "Question · Review sources" },
      { title: "Preparing an evidence-based answer...", subtitle: "Building the response from the retrieved paper content.", icon: "psychology", badge: "Question · Compose answer" },
      { title: "Adding PDF page references...", subtitle: "Connecting supported claims to their source locations.", icon: "format_quote", badge: "Question · Cite sources" },
    ];
  })();

  const DOWNLOAD_STAGES = [
    { title: "Finding the requested papers in your project...", subtitle: "Checking which selected papers are ready for transfer.", icon: "library_books", badge: "Download · Locate papers" },
    { title: "Preparing secure PDF downloads...", subtitle: "Retrieving the requested paper files from project storage.", icon: "downloading", badge: "Download · Retrieve files" },
    { title: "Finishing paper downloads...", subtitle: "Completing the requested file transfer.", icon: "download_done", badge: "Download · Finalize" },
    { title: "Finishing paper downloads...", subtitle: "Completing the requested file transfer.", icon: "download_done", badge: "Download · Finalize" },
  ];
  const ACTIVE_SEARCH_STAGES = isDownloading ? DOWNLOAD_STAGES : SEARCH_STAGES;

  const [exportingMsgId, setExportingMsgId] = useState<string | null>(null);

  const handleExportMessage = async (msg: ChatMessage, format: "pdf" | "docx") => {
    if (!msg.text) return;
    const actionKey = `${msg.id}-${format}`;
    setExportingMsgId(actionKey);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${projectName} Research Report`,
          text: msg.text,
          citations: msg.citations,
          format: format,
          documentType: msg.intent || "research_report",
          project_name: projectName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const downloadUrl = format === "docx" ? data.document?.download_url_docx : data.document?.download_url_pdf;
        if (downloadUrl) {
          window.open(downloadUrl, "_blank");
        }
      }
    } catch (err) {
      console.error("Failed to export message document:", err);
    } finally {
      setExportingMsgId(null);
    }
  };

  const [projectName, setProjectName] = useState(
    initialProjectName || (projectId === "cognitive-mapper" ? "Cognitive Mapper v4" : "Project Workspace")
  );

  // Active session title
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ||
    sessions[0] || {
      id: "new-inquiry",
      title: activeSessionId ? "Active Research Inquiry" : `${projectName} Research Inquiry`,
      paperCount: 0,
      timeLabel: "Active",
      isActive: true,
    };

  // Scroll to bottom ONLY when a new message is added, preventing forced downward scroll during paper downloads
  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  // Handle source toggle (guaranteeing at least one source remains selected)
  const toggleSource = (id: string) => {
    setSources((prev) => {
      const activeCount = prev.filter((s) => s.checked).length;
      return prev.map((s) => {
        if (s.id === id) {
          if (s.checked && activeCount <= 1) {
            return s; // Keep at least one source active
          }
          return { ...s, checked: !s.checked };
        }
        return s;
      });
    });
  };

  const selectAllSources = (selectAll: boolean) => {
    setSources((prev) =>
      prev.map((s, idx) => ({
        ...s,
        checked: selectAll || idx === 0,
      }))
    );
  };

  const activeSourcesCount = sources.filter((s) => s.checked).length;
  const activeSourcesSummary = useMemo(() => {
    const active = sources.filter((s) => s.checked);
    if (active.length === sources.length) return "All Sources (2)";
    if (active.length === 1) return active[0].name;
    return `${active.length} Sources`;
  }, [sources]);

  // Load messages for a given session from PostgreSQL
  const loadSessionMessages = async (
    sessionId: string,
    currentDownloaded: string[] = downloadedIds
  ) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/chat/messages?sessionId=${sessionId}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        // Sync paper download status with downloaded IDs
        const syncedMessages = data.messages.map((m: ChatMessage) => {
          if (!m.papers) return m;
          return {
            ...m,
            papers: m.papers.map((p) => {
              const cleanId = p.paperId ? p.paperId.split("v")[0] : "";
              const isMatch =
                (p.paperId && currentDownloaded.includes(p.paperId)) ||
                (cleanId && currentDownloaded.some((d) => d.includes(cleanId)));
              return isMatch ? { ...p, status: "downloaded" as const } : p;
            }),
          };
        });

        setMessages(syncedMessages);

        // Extract latest papers from this session
        const allPapers: PaperItem[] = [];
        syncedMessages.forEach((m: ChatMessage) => {
          if (m.papers && m.papers.length > 0) {
            m.papers.forEach((p) => {
              if (!allPapers.some((existing) => existing.paperId === p.paperId)) {
                allPapers.push(p);
              }
            });
          }
        });
        setPapers(allPapers);
      }
    } catch (err) {
      console.error("Failed to load session messages from DB:", err);
    }
  };

  // Fetch project details, downloaded paper IDs, and chat sessions from PostgreSQL
  useEffect(() => {
    let active = true;

    async function initChatbot() {
      setIsLoadingHistory(true);

      // 1. Fetch project title
      fetch(`/api/projects/${projectId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.project?.title && active) {
            setProjectName(data.project.title);
          }
        })
        .catch(() => {});

      // 2. Fetch downloaded papers list from backend
      let currentDownloaded: string[] = [];
      try {
        const dlRes = await fetch(`/api/projects/${projectId}/papers/downloaded`);
        const dlData = await dlRes.json();
        if (dlData?.downloaded_ids && Array.isArray(dlData.downloaded_ids)) {
          currentDownloaded = dlData.downloaded_ids;
          if (active) {
            setDownloadedIds(currentDownloaded);
            setQueuedCount(currentDownloaded.length);
          }
        }
      } catch (err) {
        console.error("Error loading downloaded papers:", err);
      }

      // 3. Fetch chat sessions from PostgreSQL
      try {
        const sRes = await fetch(`/api/projects/${projectId}/chat/sessions`);
        const sData = await sRes.json();
        if (active) {
          if (sData.success && Array.isArray(sData.sessions) && sData.sessions.length > 0) {
            const loadedSessions: Session[] = sData.sessions.map((s: any, idx: number) => ({
              id: s.id,
              title: s.title,
              paperCount: s.paperCount || 0,
              timeLabel: s.timeLabel || "Active",
              isActive: idx === 0,
            }));
            setSessions(loadedSessions);
            const firstId = loadedSessions[0].id;
            setActiveSessionId(firstId);
            await loadSessionMessages(firstId, currentDownloaded);
          } else {
            // New project with empty history!
            setSessions([]);
            setActiveSessionId(null);
            setMessages([]);
            setPapers([]);
          }
        }
      } catch (err) {
        console.error("Error loading chat sessions:", err);
      } finally {
        if (active) setIsLoadingHistory(false);
      }
    }

    initChatbot();

    return () => {
      active = false;
    };
  }, [projectId]);

  // Handle switching active session
  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setSessions((prev) =>
      prev.map((s) => ({ ...s, isActive: s.id === sessionId }))
    );
    loadSessionMessages(sessionId);
  };

  // Handle Paper Download Click (streams through the API and persists in Supabase Storage)
  const handleDownloadPaper = async (id: number, paperObj?: PaperItem) => {
    const targetPaper = paperObj || papers.find((p) => p.id === id);
    if (!targetPaper) return;

    if (targetPaper.status === "downloaded") return;

    const updatePaperStatus = (
      status: "downloaded" | "available" | "downloading" | "failed",
      progress?: number
    ) => {
      setPapers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status, progress } : p))
      );
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.papers) return m;
          return {
            ...m,
            papers: m.papers.map((p) =>
              p.id === id ? { ...p, status, progress } : p
            ),
          };
        })
      );
    };

    updatePaperStatus("downloading", 25);

    let currentProgress = 25;
    const progressInterval = setInterval(() => {
      currentProgress = Math.min(currentProgress + 15, 88);
      updatePaperStatus("downloading", currentProgress);
    }, 350);

    try {
      const res = await fetch(`/api/projects/${projectId}/papers/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_id: targetPaper.paperId || `paper-${id}`,
          title: targetPaper.title,
          pdf_url: targetPaper.pdfUrl,
          entry_url: targetPaper.entryUrl,
          authors: targetPaper.authors,
          venue: targetPaper.venue,
          year: targetPaper.year,
          published: targetPaper.published,
          summary: targetPaper.snippet,
        }),
      });

      clearInterval(progressInterval);

      if (res.ok) {
        const data = await res.json();
        const savedId = targetPaper.paperId || data.paper_id || `paper-${id}`;
        updatePaperStatus("downloaded", 100);
        setDownloadedIds((prev) => [...prev, savedId]);
        setQueuedCount((c) => c + 1);

        // Persist downloaded status to PostgreSQL database so it stays green on subsequent visits
        fetch(`/api/projects/${projectId}/chat/messages`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paperId: targetPaper.paperId || savedId,
            status: "downloaded",
            progress: 100,
          }),
        }).catch((e) => console.error("Error saving paper status to DB:", e));
      } else {
        updatePaperStatus("failed");
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error("Paper download error:", err);
      updatePaperStatus("failed");
    }
  };

  // Handle Rename Modal
  const openRenameModal = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    setTargetSessionId(sessionId);
    setRenameInputTitle(session ? session.title : "");
    setIsRenameModalOpen(true);
  };

  const saveRenamedTitle = async () => {
    const trimmed = renameInputTitle.trim();
    if (!trimmed || !targetSessionId) return;

    setSessions((prev) =>
      prev.map((s) => (s.id === targetSessionId ? { ...s, title: trimmed } : s))
    );
    setIsRenameModalOpen(false);

    try {
      await fetch(`/api/projects/${projectId}/chat/sessions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: targetSessionId, title: trimmed }),
      });
    } catch (err) {
      console.error("Error updating session title in DB:", err);
    }
    setTargetSessionId(null);
  };

  // Create New Chat (clears chat area and creates clean session)
  const handleNewChat = async () => {
    const newId = `session-${Date.now()}`;
    const newTitle = "New Research Inquiry";

    try {
      await fetch(`/api/projects/${projectId}/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, title: newTitle }),
      });
    } catch (err) {
      console.error("Error creating session in DB:", err);
    }

    const newSession: Session = {
      id: newId,
      title: newTitle,
      paperCount: 0,
      timeLabel: "Just now",
      isActive: true,
    };

    setSessions((prev) => [
      newSession,
      ...prev.map((s) => ({ ...s, isActive: false })),
    ]);
    setActiveSessionId(newId);
    setMessages([]);
    setPapers([]);
  };

  // Send message & AI Agent orchestration
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isSearching || isDownloading || isSynthesizing || isGeneratingDoc) return;

    // Ensure an active session exists in PostgreSQL
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      currentSessionId = `session-${Date.now()}`;
      const initialTitle = text.length > 35 ? text.slice(0, 35) + "..." : text;
      try {
        await fetch(`/api/projects/${projectId}/chat/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentSessionId, title: initialTitle }),
        });
      } catch (err) {
        console.error("Failed to create session on first message:", err);
      }

      const createdSession: Session = {
        id: currentSessionId,
        title: initialTitle,
        paperCount: 0,
        timeLabel: "Just now",
        isActive: true,
      };
      setSessions([createdSession]);
      setActiveSessionId(currentSessionId);
    }

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
      textareaRef.current.style.overflowY = "hidden";
    }

    // Persist user message to PostgreSQL
    fetch(`/api/projects/${projectId}/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: userMsg.id,
        sessionId: currentSessionId,
        sender: "user",
        text: userMsg.text,
        time: userMsg.time,
      }),
    }).catch((e) => console.error("Error saving user message to DB:", e));

    // 1. CHECK IF USER WANTS TO DOWNLOAD PAPERS NATURALLY
    const downloadAllMatch = text.match(/(?:download|get|save)\s+all/i);
    const downloadNumMatch = text.match(
      /(?:download|get|save)\s+(?:papers?|preprints?|items?)?\s*([\d\s,and#]+)/i
    );

    if (downloadAllMatch) {
      const targets = papers.filter((p) => p.status === "available" || p.status === "failed");
      if (targets.length > 0) {
        targets.forEach((p) => handleDownloadPaper(p.id, p));
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          queuedInfo: {
            count: targets.length,
            total: queuedCount + targets.length,
            paperIds: targets.map((t) => t.id),
            titles: targets.map((t) => t.title),
          },
        };
        setMessages((prev) => [...prev, aiMsg]);

        // Save AI queued message to PostgreSQL
        fetch(`/api/projects/${projectId}/chat/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: aiMsg.id,
            sessionId: currentSessionId,
            sender: "ai",
            time: aiMsg.time,
            queuedInfo: aiMsg.queuedInfo,
          }),
        }).catch((e) => console.error("Error saving AI queued message to DB:", e));

        return;
      }
    } else if (downloadNumMatch && downloadNumMatch[1]) {
      const numbers = (downloadNumMatch[1].match(/\d+/g) || []).map(Number);
      if (numbers.length > 0) {
        const targets = papers.filter((p) => numbers.includes(p.id));
        if (targets.length > 0) {
          targets.forEach((p) => handleDownloadPaper(p.id, p));
          const aiMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            sender: "ai",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            queuedInfo: {
              count: targets.length,
              total: queuedCount + targets.length,
              paperIds: targets.map((t) => t.id),
              titles: targets.map((t) => t.title),
            },
          };
          setMessages((prev) => [...prev, aiMsg]);

          fetch(`/api/projects/${projectId}/chat/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: aiMsg.id,
              sessionId: currentSessionId,
              sender: "ai",
              time: aiMsg.time,
              queuedInfo: aiMsg.queuedInfo,
            }),
          }).catch((e) => console.error("Error saving AI queued message to DB:", e));

          return;
        }
      }
    }

    // 2. UNIFIED RESEARCH CHATBOT FLOW (Search vs Grounded QA vs Compare vs Summarize)
    let effectiveLimit = paperLimit;
    const wordToNum: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      twelve: 12, fifteen: 15, twenty: 20,
    };
    const limitMatch = text.match(
      /(?:find|search|show|get|fetch|bring|look\s+for)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\s+(?:recent|new|peer-reviewed|top|more)?\s*papers?/i
    );
    if (limitMatch && limitMatch[1]) {
      const val = limitMatch[1].toLowerCase();
      effectiveLimit = wordToNum[val] || parseInt(val, 10);
      if (isNaN(effectiveLimit) || effectiveLimit <= 0) effectiveLimit = paperLimit;
      setPaperLimit(effectiveLimit);
      setCustomLimitInput(String(effectiveLimit));
    }

    let effectiveStartYear = startYear;
    let effectiveEndYear = endYear;
    const yearMatch = text.match(/(?:from\s+)?(20\d\d)\s*(?:-|to|–)\s*(20\d\d)/i);
    if (yearMatch) {
      const y1 = parseInt(yearMatch[1], 10);
      const y2 = parseInt(yearMatch[2], 10);
      if (!isNaN(y1) && !isNaN(y2) && y1 <= y2) {
        effectiveStartYear = y1;
        effectiveEndYear = y2;
        setStartYear(y1);
        setEndYear(y2);
        setStartYearInput(String(y1));
        setEndYearInput(String(y2));
      }
    }

    // Determine initial visual progress state with high-precision intent classification
    const lowerText = text.toLowerCase().trim();

    // Check if query is primarily a question or analytical synthesis prompt
    const taskMode = classifyChatTask(lowerText);
    setActiveThinkingQuery(text);
    setActiveTaskMode(taskMode);
    setSearchStage(0);
    setSynthesizingStage(0);
    setDocStage(0);

    try {
      // Collect all previously seen, screened, and downloaded paper IDs across this conversation
      const excludedIdsSet = new Set<string>();
      downloadedIds.forEach((id) => {
        if (id) excludedIdsSet.add(id);
      });
      messages.forEach((m) => {
        if (m.papers) {
          m.papers.forEach((p) => {
            if (p.paperId) excludedIdsSet.add(p.paperId);
          });
        }
      });
      allSessionScreenedIds.current.forEach((id) => excludedIdsSet.add(id));

      const excludeParam = Array.from(excludedIdsSet).slice(0, 80).join(",");
      const activeSourceIds = sources.filter((s) => s.checked).map((s) => s.id);

      const chatRes = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: currentSessionId,
          history: messages.slice(-5).map((m) => ({
            sender: m.sender,
            text: m.text || (m.isPapersResponse ? "Found papers" : ""),
            citations: m.citations || [],
            intent: m.intent,
          })),
          limit: effectiveLimit,
          startYear: effectiveStartYear,
          endYear: effectiveEndYear,
          minScore: 7,
          excludeIds: excludeParam,
          sources: activeSourceIds,
        }),
      });

      const data = await chatRes.json();

      if (data && Array.isArray(data.screened_ids)) {
        data.screened_ids.forEach((id: string) => allSessionScreenedIds.current.add(id));
      }

      if (data.intent === "paper_search" && data.is_papers_response && Array.isArray(data.papers) && data.papers.length > 0) {
        data.papers.forEach((p: any) => {
          if (p.paper_id) allSessionScreenedIds.current.add(p.paper_id);
        });
        const totalScreened = data.candidates_screened || data.papers.length;
        const serverMessage = data.message;

        const mappedPapers: PaperItem[] = data.papers.map((p: any, idx: number) => {
          const cleanId = p.paper_id;
          const isAlreadyDownloaded =
            downloadedIds.includes(cleanId) ||
            downloadedIds.some((d) => d.includes(cleanId.split("v")[0]));

          const isOa = cleanId.startsWith("oa_");
          const defaultVenue = isOa ? "Open Access" : `ArXiv:${cleanId.split("v")[0]}`;
          const defaultEntryUrl = isOa
            ? `https://openalex.org/${cleanId.replace("oa_", "")}`
            : `https://arxiv.org/abs/${cleanId}`;

          return {
            id: idx + 1,
            paperId: cleanId,
            title: p.title,
            venue: p.venue || defaultVenue,
            venueType: (p.venue_type || (isOa ? "journal" : "arxiv")) as any,
            authors:
              p.authors && p.authors.length > 0
                ? `${p.authors.slice(0, 3).join(", ")}${
                    p.authors.length > 3 ? " et al." : ""
                  } • ${p.published ? p.published.substring(0, 4) : ""}`
                : "Unknown Authors",
            snippet: p.summary
              ? `"${p.summary.slice(0, 220)}..."`
              : "No abstract available.",
            status: isAlreadyDownloaded ? ("downloaded" as const) : ("available" as const),
            pdfUrl: p.pdf_url,
            entryUrl: p.entry_url || defaultEntryUrl,
            published: p.published,
            relevanceScore: typeof p.relevance_score === "number" ? p.relevance_score : 8,
            relevanceReason: p.relevance_reason,
            matchedCriteria: Array.isArray(p.matched_criteria) ? p.matched_criteria : [],
          };
        });

        setPapers(mappedPapers);

        const introText = serverMessage
          ? serverMessage
          : `I've screened ${totalScreened} candidate preprints against your research objective. Here are ${mappedPapers.length} top-ranked papers that met the strict relevance threshold (≥7/10). You can click Download to Project on any card or command me naturally (e.g., "Download papers 1 and 3").`;

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isPapersResponse: true,
          papers: mappedPapers,
          totalVerified: mappedPapers.length,
          introText,
          intent: "paper_search",
        };

        setMessages((prev) => [...prev, aiMsg]);

        // Save AI message and papers to PostgreSQL
        fetch(`/api/projects/${projectId}/chat/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: aiMsg.id,
            sessionId: currentSessionId,
            sender: "ai",
            time: aiMsg.time,
            isPapersResponse: true,
            papers: mappedPapers,
            introText: aiMsg.introText,
            totalVerified: mappedPapers.length,
            intent: "paper_search",
          }),
        }).catch((e) => console.error("Error saving AI papers response to DB:", e));
      } else if (data.intent === "paper_qa" || data.intent === "compare_papers" || data.intent === "summarize_papers") {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isPapersResponse: false,
          text: data.answer || "No response generated.",
          citations: data.citations || [],
          intent: data.intent,
        };

        setMessages((prev) => [...prev, aiMsg]);

        // Save AI grounded message and citations to PostgreSQL
        fetch(`/api/projects/${projectId}/chat/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: aiMsg.id,
            sessionId: currentSessionId,
            sender: "ai",
            time: aiMsg.time,
            isPapersResponse: false,
            text: aiMsg.text,
            citations: aiMsg.citations,
            intent: aiMsg.intent,
          }),
        }).catch((e) => console.error("Error saving AI QA response to DB:", e));
      } else if (data.intent === "generate_document" || data.document) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isPapersResponse: false,
          text: data.answer || "I have generated your requested research document.",
          citations: data.citations || [],
          intent: "generate_document",
          document: data.document,
        };

        setMessages((prev) => [...prev, aiMsg]);

        fetch(`/api/projects/${projectId}/chat/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: aiMsg.id,
            sessionId: currentSessionId,
            sender: "ai",
            time: aiMsg.time,
            isPapersResponse: false,
            text: aiMsg.text,
            citations: aiMsg.citations,
            intent: "generate_document",
            document: aiMsg.document,
          }),
        }).catch((e) => console.error("Error saving document response to DB:", e));
      } else {
        // Conversational or fallback response
        const fallbackMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: data.answer || data.message || `No results or response generated. Try refining your research inquiry.`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          intent: data.intent || "general_chat",
        };
        setMessages((prev) => [...prev, fallbackMsg]);

        fetch(`/api/projects/${projectId}/chat/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: fallbackMsg.id,
            sessionId: currentSessionId,
            sender: "ai",
            text: fallbackMsg.text,
            time: fallbackMsg.time,
            intent: fallbackMsg.intent,
          }),
        }).catch((e) => console.error("Error saving fallback message to DB:", e));
      }

      // Auto rename session title in state and DB if active session is default
      setSessions((prev) =>
        prev.map((s) => {
          if (
            s.id === currentSessionId &&
            (s.title === "New Research Inquiry" || s.paperCount === 0)
          ) {
            const displayTitle =
              text.length > 35
                ? text.slice(0, 35) + "..."
                : text.charAt(0).toUpperCase() + text.slice(1);

            fetch(`/api/projects/${projectId}/chat/sessions`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: currentSessionId,
                title: displayTitle,
              }),
            }).catch((e) => console.error("Error updating session title in DB:", e));

            return { ...s, title: displayTitle };
          }
          return s;
        })
      );
    } catch (err) {
      console.error("Chat orchestration error:", err);
      const errorMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: `Temporary network or service issue processing research query. Please try again.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setActiveTaskMode(null);
      setActiveThinkingQuery("");
    }
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(sessionFilter.toLowerCase())
  );

  return (
    <div className="bg-background text-on-surface font-body-md text-body-md antialiased overflow-hidden flex h-screen w-screen selection:bg-primary-container selection:text-on-primary-container">
      {/* ========================================== */}
      {/* LEFT GLOBAL SIDEBAR (Common ProjectSidebar)*/}
      {/* ========================================== */}
      <ProjectSidebar activeTab="chatbot" projectId={projectId} projectName={projectName} />

      {/* ========================================== */}
      {/* MAIN WORKSPACE CONTAINER                   */}
      {/* ========================================== */}
      <div className="flex-1 flex flex-col ml-[260px] h-screen overflow-hidden bg-background">
        {/* Top Workspace Navigation Bar (Shared Component: TopNavBar) */}
        <header className="h-14 w-full px-6 flex items-center justify-between bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant/20 z-20 shrink-0">
          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/30 text-label-md font-label-md transition-all active:scale-95 shrink-0 group"
              title="Back to Projects"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">
                arrow_back
              </span>
              <span className="text-xs font-medium">Exit</span>
            </Link>

            {/* Breadcrumbs matching Project Dashboard */}
            <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
              <Link href="/projects" className="hover:text-on-surface transition-colors">
                Projects
              </Link>
              <span className="text-outline">/</span>
              <Link
                href={`/projects/${projectId}`}
                className="hover:text-on-surface text-on-surface font-semibold max-w-[220px] truncate"
                title={projectName}
              >
                {projectName}
              </Link>
              <span className="text-outline">/</span>
              <span className="text-primary font-medium">Find Papers AI Chatbot</span>
            </div>
          </div>
        </header>

        {/* Workspace Body: 2-Column Split (Left History Rail + Central Discovery Canvas) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* ========================================== */}
          {/* COLUMN 1: Chat History & Session Drawer    */}
          {/* ========================================== */}
          <aside
            className={`${
              isHistoryCollapsed
                ? "!w-0 !p-0 !border-r-0 pointer-events-none"
                : "w-[240px]"
            } shrink-0 bg-surface-container-low border-r border-outline-variant/20 flex flex-col justify-between overflow-hidden transition-all duration-300 ease-in-out`}
            id="chat-history-sidebar"
          >
            <div className="p-3 flex flex-col gap-3 h-full overflow-hidden w-[240px]">
              {/* Top Controls: New Chat CTA + Collapse Button */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleNewChat}
                  className="flex-1 py-2 px-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 flex items-center justify-center gap-1.5 font-headline-md text-xs font-medium transition-all active:scale-[0.98] truncate cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add_comment</span>
                  <span className="truncate">+ New Chat</span>
                </button>
                <button
                  onClick={() => setIsHistoryCollapsed(true)}
                  className="p-2 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high border border-outline-variant/30 transition-colors active:scale-95 shrink-0 flex items-center justify-center cursor-pointer"
                  title="Collapse Chat History"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
              </div>

              {/* Quick Filter Input */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-outline text-[16px]">
                  filter_list
                </span>
                <input
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                  className="w-full bg-surface-container-lowest/80 border border-outline-variant/30 rounded-md pl-8 pr-2 py-1.5 text-code-sm font-code-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:border-primary text-xs"
                  placeholder="Search conversations..."
                  type="text"
                />
              </div>

              {/* Section Label */}
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-code-sm font-code-sm uppercase tracking-wider text-outline text-[11px] font-semibold">
                  Recent Conversations
                </span>
                <span className="text-code-sm font-code-sm text-outline-variant text-[11px]">
                  {filteredSessions.length} Total
                </span>
              </div>

              {/* Session List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                {filteredSessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className={`p-2.5 rounded-lg relative cursor-pointer group transition-all ${
                        isActive
                          ? "bg-surface-container-high border border-primary/40 shadow-sm"
                          : "bg-surface-container/40 hover:bg-surface-container-high/60 border border-transparent hover:border-outline-variant/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={`font-headline-md text-body-md truncate leading-snug flex-1 ${
                            isActive
                              ? "font-semibold text-primary"
                              : "text-on-surface"
                          }`}
                        >
                          {session.title}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1"></span>
                          )}
                          {/* Three dots menu button for renaming */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRenameModal(session.id);
                            }}
                            className={`p-1 -mr-1 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer ${
                              isActive ? "opacity-80 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                            }`}
                            title="Rename conversation"
                          >
                            <span className="material-symbols-outlined text-[16px]">more_vert</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-code-sm font-code-sm text-[11px]">
                        <span
                          className={`flex items-center gap-1 ${
                            isActive ? "text-primary-fixed-dim" : "text-outline"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">menu_book</span>
                          {session.paperCount} papers
                        </span>
                        <span className="text-outline">{session.timeLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Session Drawer Stats */}
              <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-code-sm font-code-sm text-outline text-xs px-1">
                <span>Storage: 41/100 MB</span>
                <span className="text-primary font-medium cursor-pointer hover:underline">
                  Manage
                </span>
              </div>
            </div>
          </aside>

          {/* Collapsed History Floating / Edge Expand Dock Tab */}
          {isHistoryCollapsed && (
            <div className="absolute top-3 left-3 z-30 flex items-center">
              <button
                onClick={() => setIsHistoryCollapsed(false)}
                className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary hover:text-on-surface border border-outline-variant/40 shadow-lg backdrop-blur-md transition-all active:scale-95 group cursor-pointer"
                title="Expand Chat History"
              >
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">
                  chevron_right
                </span>
                <span className="material-symbols-outlined text-[16px] text-outline group-hover:text-primary transition-colors">
                  chat
                </span>
                <span className="text-code-sm font-code-sm text-xs font-medium">History</span>
              </button>
            </div>
          )}

          {/* ========================================== */}
          {/* COLUMN 2: Main Research Stream             */}
          {/* ========================================== */}
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {/* Top Chat Header */}
            <div className="h-14 px-6 bg-surface-container-lowest border-b border-outline-variant/20 flex items-center justify-between shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
                  <h1 className="font-headline-md font-semibold text-on-surface tracking-tight text-lg">
                    {activeSession ? activeSession.title : `${projectName} Inquiry`}
                  </h1>
                </div>
                <span className="text-outline">/</span>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-label-md text-code-sm">
                  {projectName}
                </span>
                <span className="text-outline hidden md:inline">/</span>
                {/* Model Tag Badge */}
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high border border-outline-variant/40 text-code-sm font-code-sm text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined text-[15px] text-tertiary">
                    neurology
                  </span>
                  <span>SupervisorX Scholar-v4 (ArXiv &amp; OpenAccess)</span>
                </div>
              </div>

              {/* Direct Action CTA button to queue */}
              <Link
                href={`/projects/${projectId}/analysis`}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-primary/40 text-primary hover:text-on-surface font-label-md text-label-md font-medium transition-all group shadow-sm active:scale-95 cursor-pointer"
              >
                <span>Go to Analyze Papers ({queuedCount} Queued)</span>
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </Link>
            </div>

            {/* Chat Conversation Stream (Scrollable) */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
            >
              {messages.length === 0 ? (
                <div
                  style={{ maxWidth: "680px", width: "100%" }}
                  className="h-full min-h-[420px] w-full flex flex-col items-center justify-center text-center p-8 mx-auto space-y-6 my-auto"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg">
                    <span className="material-symbols-outlined text-[36px]">psychology</span>
                  </div>
                  <div className="w-full space-y-3" style={{ width: "100%" }}>
                    <h2 className="text-2xl font-headline-md font-bold text-on-surface tracking-tight">
                      {projectName} Research Inbox
                    </h2>
                    <p
                      style={{ maxWidth: "620px", width: "100%", margin: "0 auto" }}
                      className="text-sm font-body-md text-on-surface-variant leading-relaxed text-center break-normal whitespace-normal block"
                    >
                      I am SupervisorX, your academic research assistant. Ask me to find papers (e.g. <span className="text-primary font-medium">&quot;Find recent papers on {projectName}&quot;</span>), and I will scan arXiv, formulate academic queries, and retrieve relevant literature with full open-access download capabilities.
                    </p>
                  </div>

                  {/* Suggested starter prompts */}
                  <div
                    style={{ maxWidth: "620px", width: "100%" }}
                    className="pt-2 flex flex-col sm:flex-row gap-3 w-full justify-center"
                  >
                    <button
                      type="button"
                      onClick={() => setInputMessage(`Find 5 recent papers on ${projectName}`)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-high/80 hover:bg-surface-container-highest border border-outline-variant/30 text-xs font-label-md text-on-surface hover:text-primary transition-all text-left flex items-center gap-2.5 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0">manage_search</span>
                      <span className="truncate">Find 5 recent papers on {projectName}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMessage("Find 10 recent peer-reviewed papers on sparse multi-head attention")}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-high/80 hover:bg-surface-container-highest border border-outline-variant/30 text-xs font-label-md text-on-surface hover:text-primary transition-all text-left flex items-center gap-2.5 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0">auto_awesome</span>
                      <span className="truncate">Sparse multi-head attention</span>
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const citationGroups = new Map<string, { paper: Citation; locations: Map<string, { citation: Citation; indexes: number[] }> }>();
                  for (const citation of msg.citations || []) {
                    let group = citationGroups.get(citation.paper_id);
                    if (!group) {
                      group = { paper: citation, locations: new Map() };
                      citationGroups.set(citation.paper_id, group);
                    }
                    const locationKey = `${citation.section_title}|${citation.page_label}|${citation.figure_number || ""}|${citation.claim_supported}`;
                    let location = group.locations.get(locationKey);
                    if (!location) {
                      location = { citation, indexes: [] };
                      group.locations.set(locationKey, location);
                    }
                    if (!location.indexes.includes(citation.citation_index)) location.indexes.push(citation.citation_index);
                  }
                  const referencePaperCount = citationGroups.size;
                  const referenceLocationCount = Array.from(citationGroups.values()).reduce((count, group) => count + group.locations.size, 0);
                  if (msg.sender === "user") {
                    return (
                      <div
                        key={msg.id}
                        className="flex items-start justify-end gap-3 max-w-4xl ml-auto"
                      >
                        <div className="flex flex-col items-end gap-1">
                          <div className="bg-primary-container text-on-primary-container px-4 py-3 rounded-2xl rounded-tr-none shadow-sm max-w-[650px] font-body-md text-body-md">
                          {msg.text}
                        </div>
                        <span className="text-code-sm font-code-sm text-outline text-[11px] pr-1">
                          {msg.time} {msg.tag && `· ${msg.tag}`}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-primary text-xs font-bold shrink-0 border border-outline-variant/40">
                        DR
                      </div>
                    </div>
                  );
                }

                // AI Response with Papers Section
                if (msg.isPapersResponse) {
                  return (
                    <div
                      key={msg.id}
                      className="flex items-start gap-3 max-w-5xl mr-auto"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-tertiary flex items-center justify-center text-on-primary text-xs shrink-0 shadow-md">
                        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl rounded-tl-none p-4 shadow-sm text-body-md text-on-surface">
                          <p className="leading-relaxed">
                            {msg.introText ? (
                              msg.introText
                            ) : (
                              <>
                                I&apos;ve scanned{" "}
                                <span className="text-primary font-medium">ArXiv (cs.CL, cs.LG)</span>{" "}
                                and{" "}
                                <span className="text-primary font-medium">
                                  conference proceedings
                                </span>{" "}
                                from {startYear}-{endYear}. Here are {(msg.papers || papers).length} highly relevant papers matching your
                                criteria for{" "}
                                <span className="text-on-surface font-semibold">
                                  {projectName}
                                </span>
                                . You can click{" "}
                                <span className="text-primary-fixed-dim font-mono text-xs bg-surface-container px-1 py-0.5 rounded">
                                  Download to Project
                                </span>{" "}
                                on any card or command me naturally (e.g.,{" "}
                                <span className="italic text-on-surface-variant">
                                  &quot;Download papers 2, 4 and 7&quot;
                                </span>
                                ).
                              </>
                            )}
                          </p>
                        </div>

                        {/* COMPACT PAPER CARDS SECTION */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-1 border-b border-outline-variant/20">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-primary text-[18px]">
                                auto_awesome
                              </span>
                              <span className="font-headline-md text-body-md font-semibold text-on-surface">
                                Discovered Preprints &amp; Conference Papers
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-surface-container text-xs font-code-sm text-primary border border-outline-variant/30">
                                {msg.totalVerified || (msg.papers || papers).length} Verified
                              </span>
                            </div>
                            <span className="text-code-sm font-code-sm text-outline text-xs">
                              Sorted by Relevance Score • ArXiv Open Access
                            </span>
                          </div>

                          {/* Render Paper Cards */}
                          {(msg.papers || papers).map((paper) => (
                            <article
                              key={paper.id}
                              className={`p-3.5 rounded-xl border transition-all flex flex-col md:flex-row md:items-start justify-between gap-3 relative overflow-hidden group ${
                                paper.status === "failed"
                                  ? "bg-surface-container-low border-error/40 hover:border-error"
                                  : paper.status === "downloading"
                                  ? "bg-surface-container-high/70 border-primary/50"
                                  : "bg-surface-container-low border-outline-variant/30 hover:border-primary/50 shadow-sm hover:shadow-md"
                              }`}
                            >
                              {/* Animated Progress Bar for downloading state */}
                              {paper.status === "downloading" && (
                                <div
                                  className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300"
                                  style={{ width: `${paper.progress || 35}%` }}
                                ></div>
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-code-sm font-code-sm font-semibold ${
                                      paper.status === "failed" ? "text-error" : "text-primary"
                                    }`}
                                  >
                                    #{paper.id}
                                  </span>
                                  {/* Paper Title Clickable in New Tab */}
                                  <a
                                    href={paper.entryUrl || paper.pdfUrl || `https://arxiv.org/abs/${paper.paperId || ""}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-headline-md text-body-md font-semibold text-on-surface hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1.5 group/title"
                                    title="Click to view and read paper on arXiv in a new tab"
                                  >
                                    <span className="truncate max-w-[420px] md:max-w-[540px]">{paper.title}</span>
                                    <span className="material-symbols-outlined text-[15px] opacity-60 group-hover/title:opacity-100 text-outline group-hover/title:text-primary transition-all shrink-0">
                                      open_in_new
                                    </span>
                                  </a>
                                  <span
                                    className={`text-code-sm font-code-sm px-1.5 py-0.2 rounded text-[11px] border ${
                                      paper.venueType === "conference"
                                        ? "bg-surface-container-high text-tertiary border-tertiary/20 font-medium"
                                        : "bg-surface-container-high text-outline border-outline-variant/30"
                                    }`}
                                  >
                                    {paper.venue}
                                  </span>
                                  {/* Relevance Score Badge */}
                                  {paper.relevanceScore !== undefined && (
                                    <span
                                      className={`text-code-sm font-code-sm px-2 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 shrink-0 ${
                                        paper.relevanceScore >= 9
                                          ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/40"
                                          : paper.relevanceScore >= 7
                                          ? "bg-primary/20 text-primary border-primary/40"
                                          : "bg-amber-950/70 text-amber-300 border-amber-500/40"
                                      }`}
                                      title={`Assessed by AI literature screener: ${paper.relevanceScore}/10 relevance score`}
                                    >
                                      <span className="material-symbols-outlined text-[13px]">
                                        {paper.relevanceScore >= 9 ? "verified" : "check_circle"}
                                      </span>
                                      {paper.relevanceScore}/10 Match
                                    </span>
                                  )}
                                </div>
                                <p className="text-code-sm font-code-sm text-outline mt-0.5">
                                  {paper.authors}{" "}
                                  {paper.tag && (
                                    <>
                                      •{" "}
                                      <span className="text-emerald-400/90">{paper.tag}</span>
                                    </>
                                  )}
                                </p>
                                <p className="text-body-md text-on-surface-variant text-sm mt-1 line-clamp-2">
                                  {paper.snippet}
                                </p>

                                {/* Evidence-Based Relevance Reasoning Box */}
                                {paper.relevanceReason && (
                                  <div className="mt-2.5 p-2.5 rounded-lg bg-surface-container-high/60 border border-outline-variant/20 text-xs">
                                    <div className="flex items-center gap-1.5 text-primary font-medium mb-1">
                                      <span className="material-symbols-outlined text-[14px]">psychology</span>
                                      <span className="font-semibold text-[11px] uppercase tracking-wide">AI Relevance Analysis</span>
                                    </div>
                                    <p className="text-on-surface-variant/90 leading-relaxed font-sans">
                                      {paper.relevanceReason}
                                    </p>
                                    {paper.matchedCriteria && paper.matchedCriteria.length > 0 && (
                                      <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-1.5 border-t border-outline-variant/15">
                                        <span className="text-outline text-[10px] uppercase font-bold tracking-wider">Matched:</span>
                                        {paper.matchedCriteria.map((criterion, idx) => (
                                          <span
                                            key={idx}
                                            className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20 font-medium"
                                          >
                                            {criterion}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Right status / action buttons */}
                              <div className="shrink-0 flex items-center gap-2">
                                {paper.status === "downloaded" && (
                                  <button
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 text-label-md font-label-md cursor-default shrink-0 shadow-sm"
                                    disabled
                                  >
                                    <span
                                      className="material-symbols-outlined text-[16px] text-emerald-400"
                                      style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                      check_circle
                                    </span>
                                    <span>Already in Project - Downloaded</span>
                                  </button>
                                )}

                                {paper.status === "available" && (
                                  <button
                                    onClick={() => handleDownloadPaper(paper.id, paper)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim text-label-md font-label-md font-medium transition-all active:scale-95 shadow-sm cursor-pointer shrink-0"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">
                                      download
                                    </span>
                                    <span>Download to Project</span>
                                  </button>
                                )}

                                {paper.status === "downloading" && (
                                  <div className="shrink-0 flex items-center gap-2 min-w-[190px]">
                                    <div className="w-full flex flex-col gap-1">
                                      <div className="flex items-center justify-between text-code-sm font-code-sm text-primary text-xs">
                                        <span className="flex items-center gap-1">
                                          <span className="material-symbols-outlined animate-spin text-[14px]">
                                            sync
                                          </span>
                                          Downloading to storage...
                                        </span>
                                        <span className="font-bold">{paper.progress || 35}%</span>
                                      </div>
                                      <div className="w-full bg-surface-container-lowest h-1.5 rounded-full overflow-hidden border border-outline-variant/20">
                                        <div
                                          className="bg-primary h-full rounded-full transition-all duration-300"
                                          style={{ width: `${paper.progress || 35}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {paper.status === "failed" && (
                                  <button
                                    onClick={() => handleDownloadPaper(paper.id, paper)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error-container text-on-error-container hover:bg-error-container/80 text-label-md font-label-md font-medium transition-all active:scale-95 shadow-sm border border-error/30 cursor-pointer shrink-0"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-error">
                                      refresh
                                    </span>
                                    <span>Download Failed - Retry</span>
                                  </button>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                // AI Queued / Follow-up Response
                if (msg.queuedInfo) {
                  return (
                    <div
                      key={msg.id}
                      className="flex items-start gap-3 max-w-4xl mr-auto"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-tertiary flex items-center justify-center text-on-primary text-xs shrink-0 shadow-md">
                        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                      </div>
                      <div className="space-y-2">
                        <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl rounded-tl-none p-4 shadow-sm text-body-md text-on-surface">
                          <p>
                            Queueing papers{" "}
                            {msg.queuedInfo.paperIds.map((pid, idx) => (
                              <span key={pid}>
                                {idx > 0 &&
                                  (idx === msg.queuedInfo!.paperIds.length - 1
                                    ? " and "
                                    : ", ")}
                                <strong className="text-primary font-mono">#{pid}</strong>
                                {msg.queuedInfo?.titles && msg.queuedInfo.titles[idx]
                                  ? ` ('${msg.queuedInfo.titles[idx].slice(0, 24)}...')`
                                  : ""}
                              </span>
                            ))}{" "}
                            to{" "}
                            <span className="font-medium text-on-surface">
                              {projectName}
                            </span>{" "}
                            vault. Ingestion will auto-trigger in your background pipeline.
                          </p>
                          <div className="mt-3 p-3 rounded-lg bg-surface-container border border-outline-variant/30 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-primary text-[20px] animate-pulse">
                                playlist_add_check
                              </span>
                              <span className="text-label-md font-label-md text-on-surface">
                                {msg.queuedInfo.count} Papers Dispatched to Ingestion Pipeline ({msg.queuedInfo.total} Total Queued)
                              </span>
                            </div>
                            <Link
                              href={`/projects/${projectId}/analysis`}
                              className="text-primary text-xs font-code-sm hover:underline flex items-center gap-1"
                            >
                              Open Queue
                              <span className="material-symbols-outlined text-[14px]">
                                open_in_new
                              </span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Generic AI text / Grounded QA / Comparison / Summary response
                return (
                  <div
                    key={msg.id}
                    className="flex items-start gap-3 max-w-5xl mr-auto"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-tertiary flex items-center justify-center text-on-primary text-xs shrink-0 shadow-md">
                      <span className="material-symbols-outlined text-[18px]">
                        {msg.intent === "generate_document" || msg.document
                          ? "article"
                          : msg.intent === "compare_papers"
                          ? "balance"
                          : msg.intent === "summarize_papers"
                          ? "summarize"
                          : msg.citations && msg.citations.length > 0
                          ? "psychology"
                          : "smart_toy"}
                      </span>
                    </div>

                    <div className="flex-1 space-y-3 min-w-0">
                      {/* Intent pill badge if QA / Compare / Summary / Document */}
                      {msg.intent &&
                        (msg.intent === "paper_qa" ||
                          msg.intent === "compare_papers" ||
                          msg.intent === "summarize_papers" ||
                          msg.intent === "generate_document") && (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-code-sm font-semibold border ${
                              msg.intent === "generate_document"
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                : "bg-primary/10 border-primary/30 text-primary"
                            }`}>
                              <span className="material-symbols-outlined text-[13px]">
                                {msg.intent === "generate_document"
                                  ? "description"
                                  : msg.intent === "compare_papers"
                                  ? "compare_arrows"
                                  : msg.intent === "summarize_papers"
                                  ? "auto_stories"
                                  : "verified"}
                              </span>
                              {msg.intent === "generate_document"
                                ? "Typeset Academic Document"
                                : msg.intent === "compare_papers"
                                ? "Comparative Research Synthesis"
                                : msg.intent === "summarize_papers"
                                ? "Structured Literature Summary"
                                : "Evidence-Grounded Answer"}
                            </span>
                            <span className="text-code-sm text-outline text-[11px]">
                              {msg.intent === "generate_document" ? "DOCX / PDF Artifact" : "Grounded on Analyzed PDFs"}
                            </span>
                          </div>
                        )}

                      {/* Main Formatted Markdown Answer */}
                      <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl rounded-tl-none p-4 md:p-5 shadow-sm text-body-md text-on-surface">
                        <FormattedResearchMarkdown content={msg.text || ""} />
                      </div>

                      {/* Generated Document Card if present */}
                      {msg.document && (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-surface-container-high/90 via-surface-container to-amber-950/20 border border-amber-500/30 shadow-md">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                                <span className="material-symbols-outlined text-[24px]">
                                  {msg.document.format.toLowerCase() === "docx" ? "description" : "picture_as_pdf"}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-semibold text-sm text-on-surface truncate">
                                  {msg.document.title || "Research Document"}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-[11px] font-code-sm text-outline flex-wrap">
                                  <span className="px-1.5 py-0.5 rounded bg-surface-container-highest border border-outline-variant/30 text-on-surface-variant font-medium">
                                    {msg.document.document_type || "Research Report"}
                                  </span>
                                  {msg.document.sections_count ? (
                                    <span>{msg.document.sections_count} sections</span>
                                  ) : null}
                                  {msg.document.sources_count ? (
                                    <span>• {msg.document.sources_count} papers cited</span>
                                  ) : null}
                                  {msg.document.file_size_bytes ? (
                                    <span>• {(msg.document.file_size_bytes / 1024).toFixed(1)} KB</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {(msg.document.formats_available || (msg.document.format === "both" ? ["pdf", "docx"] : [msg.document.format])).includes("pdf") && (
                              <a
                                href={msg.document.download_url_pdf || `/api/projects/${projectId}/documents/${msg.document.id || msg.document.document_id}/download?format=pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 transition-all text-xs font-medium cursor-pointer shadow-sm active:scale-95"
                                title="Download PDF document"
                              >
                                <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                                <span>PDF</span>
                              </a>
                              )}
                              {(msg.document.formats_available || (msg.document.format === "both" ? ["pdf", "docx"] : [msg.document.format])).includes("docx") && (
                              <a
                                href={msg.document.download_url_docx || `/api/projects/${projectId}/documents/${msg.document.id || msg.document.document_id}/download?format=docx`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition-all text-xs font-medium cursor-pointer shadow-sm active:scale-95"
                                title="Download Word (.docx) document"
                              >
                                <span className="material-symbols-outlined text-[16px]">description</span>
                                <span>DOCX</span>
                              </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Collapsible references grouped by canonical paper ID */}
                      {referencePaperCount > 0 && (
                        <div className="rounded-xl bg-surface-container/60 border border-outline-variant/30 overflow-hidden">
                          <button
                            type="button"
                            aria-expanded={Boolean(expandedReferenceMessages[msg.id])}
                            aria-controls={expandedReferenceMessages[msg.id] ? `references-${msg.id}` : undefined}
                            onClick={() => setExpandedReferenceMessages((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                            className="w-full p-3.5 md:p-4 flex items-center justify-between gap-3 text-left hover:bg-surface-container-high/60 transition-colors"
                          >
                            <span className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                              <span className="material-symbols-outlined text-primary text-[18px]">menu_book</span>
                              {expandedReferenceMessages[msg.id] ? "Hide references" : `See references (${referencePaperCount} ${referencePaperCount === 1 ? "paper" : "papers"} · ${referenceLocationCount} ${referenceLocationCount === 1 ? "source location" : "source locations"})`}
                            </span>
                            <span className="material-symbols-outlined text-outline" aria-hidden="true">
                              {expandedReferenceMessages[msg.id] ? "expand_less" : "expand_more"}
                            </span>
                          </button>

                          {expandedReferenceMessages[msg.id] && (
                            <div id={`references-${msg.id}`} className="p-3.5 md:p-4 pt-0 grid grid-cols-1 gap-2.5">
                              {Array.from(citationGroups.entries()).map(([paperId, group]) => (
                                <section key={paperId} className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20 text-xs">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <a href={group.paper.pdf_url || `https://arxiv.org/abs/${paperId}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-on-surface hover:text-primary transition-colors inline-flex items-center gap-1">
                                        {group.paper.paper_title}
                                        <span className="material-symbols-outlined text-[13px] opacity-70" aria-hidden="true">open_in_new</span>
                                      </a>
                                      <p className="text-[11px] text-outline font-code-sm mt-1">{group.paper.authors} {group.paper.year ? `(${group.paper.year})` : ""}</p>
                                    </div>
                                    <a href={group.paper.pdf_url || `https://arxiv.org/abs/${paperId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface hover:text-primary transition-all text-[11px] font-medium shrink-0">
                                      <span>View PDF</span><span className="material-symbols-outlined text-[14px]" aria-hidden="true">picture_as_pdf</span>
                                    </a>
                                  </div>
                                  <ul className="mt-2 space-y-2 border-t border-outline-variant/10 pt-2">
                                    {Array.from(group.locations.values()).map(({ citation, indexes }) => (
                                      <li key={`${citation.section_title}|${citation.page_label}|${citation.figure_number || ""}|${citation.claim_supported}`} className="space-y-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {indexes.map((index) => <span key={index} className="px-1.5 py-0.5 rounded font-mono font-bold bg-primary/20 text-primary border border-primary/40 text-[11px]">[{index}]</span>)}
                                          <span className="px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant/30 text-on-surface-variant font-code-sm text-[11px]">{citation.section_title}</span>
                                          <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary font-code-sm text-[11px] font-medium">{citation.page_label}</span>
                                          {citation.is_visual && <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-code-sm text-[11px]">Visual Analysis: {citation.figure_number || "Figure"}</span>}
                                        </div>
                                        {citation.claim_supported && <p className="text-on-surface-variant text-[11px] italic leading-relaxed">&quot;{citation.claim_supported}&quot;</p>}
                                      </li>
                                    ))}
                                  </ul>
                                </section>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }))}

              {/* Dynamic Real-time Searching & Abstract Screening Indicator (Online Literature Discovery / Radar) */}
              {(isSearching || isDownloading) && (
                <div className="flex items-start gap-3 max-w-4xl mr-auto animate-fadeIn">
                  {/* Distinct Emerald Radar Avatar with concentric pulsing rings & rotating sweep beam */}
                  <div className={`relative w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden ${isDownloading ? "bg-gradient-to-br from-sky-500/25 to-blue-500/30 border-sky-500/40 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.25)]" : "bg-gradient-to-br from-emerald-500/25 to-teal-500/30 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]"}`}>
                    <span className={`absolute inset-0 rounded-xl border animate-pulse-ring pointer-events-none ${isDownloading ? "border-sky-400/40" : "border-emerald-400/40"}`}></span>
                    {!isDownloading && <span className="absolute inset-0 rounded-xl border-t-2 border-r border-emerald-400 animate-radar-sweep pointer-events-none opacity-80"></span>}
                    <span className={`material-symbols-outlined text-[20px] relative z-10 ${isDownloading ? "text-sky-300" : "text-emerald-300"}`}>
                      {isDownloading ? "download" : "radar"}
                    </span>
                  </div>

                  {/* Emerald Radar Card */}
                  <div className={`border rounded-2xl rounded-tl-none p-4.5 text-on-surface flex-1 max-w-xl relative overflow-hidden backdrop-blur-md ${isDownloading ? "bg-gradient-to-br from-sky-950/40 via-surface-container-low to-blue-950/20 border-sky-500/40 shadow-[0_8px_32px_rgba(14,165,233,0.14)]" : "bg-gradient-to-br from-emerald-950/40 via-surface-container-low to-teal-950/20 border-emerald-500/40 shadow-[0_8px_32px_rgba(16,185,129,0.14)]"}`}>
                    {/* Top Accent Gradient Bar */}
                    <div className={`absolute top-0 left-0 right-0 h-[2px] ${isDownloading ? "bg-gradient-to-r from-sky-500/0 via-sky-400 to-blue-400/0" : "bg-gradient-to-r from-emerald-500/0 via-emerald-400 to-teal-400/0"}`} />

                    {/* Top Header Badge & Live Scanner Status */}
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2.5 border-b border-emerald-500/20">
                      <span className={`text-[11px] font-code-sm font-bold uppercase tracking-wider px-3 py-0.5 rounded-full border flex items-center gap-1.5 shadow-sm ${isDownloading ? "text-sky-300 bg-sky-500/15 border-sky-500/30" : "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"}`}>
                        <span className={`material-symbols-outlined text-[14px] ${isDownloading ? "text-sky-400" : "text-emerald-400"}`}>
                          {ACTIVE_SEARCH_STAGES[searchStage].icon}
                        </span>
                        {ACTIVE_SEARCH_STAGES[searchStage].badge}
                      </span>
                      <span className={`text-code-sm text-[11px] flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${isDownloading ? "text-sky-400/90 bg-sky-950/60 border-sky-800/40" : "text-emerald-400/90 bg-emerald-950/60 border-emerald-800/40"}`}>
                        <span className="relative flex h-2 w-2">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDownloading ? "bg-sky-400" : "bg-emerald-400"}`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${isDownloading ? "bg-sky-400" : "bg-emerald-400"}`}></span>
                        </span>
                        {isDownloading ? "Paper transfer" : "Literature search"}
                      </span>
                    </div>

                    {/* Active Inquiry Pill */}
                    {activeThinkingQuery && (
                      <div className="mb-2.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/25 text-xs text-emerald-200/90 flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400 text-[15px] shrink-0">
                          {isDownloading ? "download" : "travel_explore"}
                        </span>
                        <span className="truncate">
                          {isDownloading ? "Preparing:" : "Searching:"} <span className="font-semibold text-emerald-100">&ldquo;{activeThinkingQuery}&rdquo;</span>
                        </span>
                      </div>
                    )}

                    {/* Stage Title with spinning sync */}
                    <p className={`font-semibold text-body-md flex items-center gap-2 ${isDownloading ? "text-sky-100" : "text-emerald-100"}`}>
                      <span className={`material-symbols-outlined text-[18px] animate-spin shrink-0 ${isDownloading ? "text-sky-400" : "text-emerald-400"}`}>
                        sync
                      </span>
                      <span>{ACTIVE_SEARCH_STAGES[searchStage].title}</span>
                    </p>
                    <p className={`text-xs mt-1 pl-6.5 leading-relaxed ${isDownloading ? "text-sky-200/70" : "text-emerald-200/70"}`}>
                      {ACTIVE_SEARCH_STAGES[searchStage].subtitle}
                    </p>

                    {/* Active Repository Scanning Telemetry Bar */}
                    <div className="mt-3 pl-6.5">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {isDownloading ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-[10px] font-code-sm px-2 py-0.5 rounded bg-sky-950/70 border border-sky-600/40 text-sky-300">Project paper library</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-code-sm px-2 py-0.5 rounded bg-sky-950/70 border border-sky-600/40 text-sky-300">PDF file transfer</span>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-[10px] font-code-sm px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-600/40 text-emerald-300">{sources.filter((source) => source.checked).map((source) => source.name).join(" · ") || "Academic sources"}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-code-sm px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-600/40 text-emerald-300">Finding relevant papers</span>
                          </>
                        )}
                      </div>

                      {/* Moving Laser Beam Scanner */}
                      <div className={`relative h-1.5 w-full rounded-full overflow-hidden ${isDownloading ? "bg-sky-950/80 border border-sky-800/30" : "bg-emerald-950/80 border border-emerald-800/30"}`}>
                        <div className={`absolute inset-y-0 w-2/5 animate-laser-scan rounded-full bg-gradient-to-r from-transparent ${isDownloading ? "via-sky-400" : "via-emerald-400"} to-transparent`}></div>
                      </div>
                    </div>

                    {/* Progress Step Dots */}
                    <div className="flex items-center gap-2 mt-3 pl-6.5">
                      {[0, 1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            step === searchStage
                              ? isDownloading ? "w-8 bg-sky-400 shadow-[0_0_8px_#38bdf8]" : "w-8 bg-emerald-400 shadow-[0_0_8px_#34d399]"
                              : step < searchStage
                              ? isDownloading ? "w-3 bg-sky-600" : "w-3 bg-emerald-600"
                              : "w-2.5 bg-surface-container-high/80"
                          }`}
                        />
                      ))}
                      <span className="text-[10px] font-code-sm text-emerald-300/80 ml-auto">
                        <span className={isDownloading ? "text-sky-300/80" : "text-emerald-300/80"}>{isDownloading ? "Transfer in progress" : "Search in progress"}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Distinct Real-time Grounded Q&A / Synthesis Progress Indicator (Neural Brain Cognition) */}
              {isSynthesizing && (
                <div className="flex items-start gap-3 max-w-4xl mr-auto animate-fadeIn">
                  {/* Distinct Violet Neural Brain Avatar with synaptic glow & brain wave ring */}
                  <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/30 via-purple-600/35 to-indigo-600/30 border border-purple-500/45 flex items-center justify-center text-purple-300 shrink-0 shadow-[0_0_18px_rgba(168,85,247,0.3)] animate-synaptic-glow overflow-hidden">
                    <span className="absolute inset-0 rounded-xl border border-purple-400/40 animate-pulse-ring pointer-events-none"></span>
                    <span className="material-symbols-outlined text-[20px] text-purple-200 relative z-10 animate-pulse">
                      {activeTaskMode === "summary" ? "auto_stories" : activeTaskMode === "comparison" ? "compare_arrows" : activeTaskMode === "chat" ? "chat_bubble" : "psychology"}
                    </span>
                  </div>

                  {/* Purple/Violet Neural Reasoning Card */}
                  <div className="bg-gradient-to-br from-purple-950/40 via-surface-container-low to-indigo-950/25 border border-purple-500/40 rounded-2xl rounded-tl-none p-4.5 shadow-[0_8px_32px_rgba(168,85,247,0.18)] text-on-surface flex-1 max-w-xl relative overflow-hidden backdrop-blur-md">
                    {/* Top Accent Gradient Bar */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500/0 via-purple-400 to-indigo-400/0" />

                    {/* Top Header Badge & Live Neural Status */}
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2.5 border-b border-purple-500/20">
                      <span className="text-[11px] font-code-sm font-bold uppercase tracking-wider text-purple-300 px-3 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center gap-1.5 shadow-sm">
                        <span className="material-symbols-outlined text-[14px] text-purple-400">
                          {QA_STAGES[synthesizingStage].icon}
                        </span>
                        {QA_STAGES[synthesizingStage].badge}
                      </span>
                      <span className="text-code-sm text-purple-400/90 text-[11px] flex items-center gap-1.5 bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-800/40">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400"></span>
                        </span>
                        {activeTaskMode === "summary" ? "Paper summary" : activeTaskMode === "comparison" ? "Paper comparison" : activeTaskMode === "chat" ? "Quick response" : "Research answer"}
                      </span>
                    </div>

                    {/* Active Question Inquiry Pill */}
                    {activeThinkingQuery && (
                      <div className="mb-2.5 px-3 py-1.5 rounded-lg bg-purple-950/50 border border-purple-500/25 text-xs text-purple-200/90 flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400 text-[15px] shrink-0">
                          neurology
                        </span>
                        <span className="truncate">
                          {activeTaskMode === "summary" ? "Summarizing:" : activeTaskMode === "comparison" ? "Comparing:" : activeTaskMode === "chat" ? "Responding to:" : "Answering:"} <span className="font-semibold text-purple-100">&ldquo;{activeThinkingQuery}&rdquo;</span>
                        </span>
                      </div>
                    )}

                    {/* Stage Title with spinning autorenew */}
                    <p className="font-semibold text-body-md text-purple-100 flex items-center gap-2">
                      <span className="material-symbols-outlined text-purple-400 text-[18px] animate-spin shrink-0">
                        autorenew
                      </span>
                      <span>{QA_STAGES[synthesizingStage].title}</span>
                    </p>
                    <p className="text-xs text-purple-200/70 mt-1 pl-6.5 leading-relaxed">
                      {QA_STAGES[synthesizingStage].subtitle}
                    </p>

                    {/* Animated Neural Waveform & Vector Telemetry */}
                    <div className="mt-3 pl-6.5 flex items-center justify-between gap-3">
                      {/* Live 7-Bar Neural Thinking Equalizer */}
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-950/60 rounded-lg border border-purple-800/40 shadow-inner">
                        <span className="text-[10px] font-code-sm text-purple-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-purple-400">graphic_eq</span>
                          {activeTaskMode === "summary" ? "Summary synthesis" : activeTaskMode === "comparison" ? "Evidence comparison" : activeTaskMode === "chat" ? "Response" : "Evidence review"}
                        </span>
                        <div className="flex items-end gap-1 h-5 w-16 justify-center">
                          <span className="w-1 bg-purple-400 rounded-full wave-bar-1"></span>
                          <span className="w-1 bg-purple-300 rounded-full wave-bar-2"></span>
                          <span className="w-1 bg-violet-400 rounded-full wave-bar-3"></span>
                          <span className="w-1 bg-indigo-300 rounded-full wave-bar-4"></span>
                          <span className="w-1 bg-purple-400 rounded-full wave-bar-5"></span>
                          <span className="w-1 bg-violet-300 rounded-full wave-bar-6"></span>
                          <span className="w-1 bg-purple-400 rounded-full wave-bar-7"></span>
                        </div>
                      </div>

                      {activeTaskMode !== "chat" && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(activeTaskMode === "summary"
                            ? ["Analyzed paper sections", "PDF page references"]
                            : activeTaskMode === "comparison"
                              ? ["Paper-by-paper evidence", "Source references"]
                              : ["Analyzed PDFs", "Section and page citations"]
                          ).map((label) => (
                            <span key={label} className="inline-flex items-center gap-1 text-[10px] font-code-sm px-2 py-0.5 rounded bg-purple-950/70 border border-purple-700/40 text-purple-300">{label}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Progress Step Dots */}
                    <div className="flex items-center gap-2 mt-3 pl-6.5">
                      {[0, 1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            step === synthesizingStage
                              ? "w-8 bg-purple-400 shadow-[0_0_8px_#a855f7]"
                              : step < synthesizingStage
                              ? "w-3 bg-purple-600"
                              : "w-2.5 bg-surface-container-high/80"
                          }`}
                        />
                      ))}
                      <span className="text-[10px] font-code-sm text-purple-300/80 ml-auto">
                        Stage {synthesizingStage + 1} of 4
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Distinct Real-time Document Generation & Typesetting Indicator */}
              {isGeneratingDoc && (
                <div className="flex items-start gap-3 max-w-4xl mr-auto animate-fadeIn">
                  {/* Distinct Amber Typesetting Avatar */}
                  <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/25 via-orange-500/30 to-amber-600/25 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 shadow-[0_0_18px_rgba(245,158,11,0.25)] overflow-hidden">
                    <span className="absolute inset-0 rounded-xl border border-amber-400/40 animate-pulse-ring pointer-events-none"></span>
                    <span className="material-symbols-outlined text-[20px] text-amber-200 relative z-10 animate-pulse">
                      print
                    </span>
                  </div>

                  {/* Amber Typesetting Card */}
                  <div className="bg-gradient-to-br from-amber-950/40 via-surface-container-low to-orange-950/20 border border-amber-500/40 rounded-2xl rounded-tl-none p-4.5 shadow-[0_8px_32px_rgba(245,158,11,0.15)] text-on-surface flex-1 max-w-xl relative overflow-hidden backdrop-blur-md">
                    {/* Top Accent Gradient Bar */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500/0 via-amber-400 to-orange-400/0" />

                    {/* Top Header Badge & Live Typesetting Status */}
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2.5 border-b border-amber-500/20">
                      <span className="text-[11px] font-code-sm font-bold uppercase tracking-wider text-amber-300 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                        <span className="material-symbols-outlined text-[14px] text-amber-400">
                          {DOC_STAGES[docStage].icon}
                        </span>
                        {DOC_STAGES[docStage].badge}
                      </span>
                      <span className="text-code-sm text-amber-400/90 text-[11px] flex items-center gap-1.5 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/40">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                        </span>
                        {documentTaskKind === "summary" ? "Summary document" : documentTaskKind === "comparison" ? "Comparison document" : "Document export"}
                      </span>
                    </div>

                    {/* Stage Title with spinning sync */}
                    <p className="font-semibold text-body-md text-amber-100 flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-400 text-[18px] animate-spin shrink-0">
                        sync
                      </span>
                      <span>{DOC_STAGES[docStage].title}</span>
                    </p>
                    <p className="text-xs text-amber-200/70 mt-1 pl-6.5 leading-relaxed">
                      {DOC_STAGES[docStage].subtitle}
                    </p>

                    {/* Show only the file formats requested by the user. */}
                    <div className="mt-3 pl-6.5 flex items-center gap-2 flex-wrap">
                      {requestedDocumentFormats.map((format) => (
                        <span key={format} className="inline-flex items-center gap-1 text-[10px] font-code-sm px-2 py-0.5 rounded bg-amber-950/70 border border-amber-600/40 text-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          {format} requested
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1 text-[10px] font-code-sm px-2 py-0.5 rounded bg-amber-950/70 border border-amber-600/40 text-amber-300">Source references included when available</span>
                    </div>

                    {/* Progress Step Dots */}
                    <div className="flex items-center gap-2 mt-3 pl-6.5">
                      {[0, 1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            step === docStage
                              ? "w-8 bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                              : step < docStage
                              ? "w-3 bg-amber-600"
                              : "w-2.5 bg-surface-container-high/80"
                          }`}
                        />
                      ))}
                      <span className="text-[10px] font-code-sm text-amber-300/80 ml-auto">
                        Document in progress
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================== */}
            {/* STICKY BOTTOM CONVERSATIONAL INPUT BAR     */}
            {/* ========================================== */}
            <div className="p-4 bg-surface-container-lowest/90 backdrop-blur-md border-t border-outline-variant/20 shrink-0">
              <div className="max-w-5xl mx-auto space-y-2.5">
                {/* Quick Prompt Suggestion Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-code-sm font-code-sm no-scrollbar">
                  <span className="text-outline text-xs flex items-center gap-1 shrink-0">
                    <span className="material-symbols-outlined text-[14px]">bolt</span>
                    Quick:
                  </span>
                  <button
                    onClick={() => {
                      setInputMessage("Summarize all eligible analyzed papers and give me a PDF");
                    }}
                    className="px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition-all whitespace-nowrap active:scale-95 cursor-pointer text-xs flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>
                    PDF Summary Report
                  </button>
                  <button
                    onClick={() => {
                      setInputMessage("Compare methods and results of analyzed papers and export as DOCX");
                    }}
                    className="px-2.5 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 transition-all whitespace-nowrap active:scale-95 cursor-pointer text-xs flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px]">description</span>
                    Word Comparison Report
                  </button>
                  <button
                    onClick={() => {
                      setInputMessage("Download all remaining papers");
                    }}
                    className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-primary transition-all whitespace-nowrap active:scale-95 cursor-pointer text-xs"
                  >
                    Download all remaining papers
                  </button>
                  <button
                    onClick={() => {
                      setInputMessage("Find 5 more papers on quantization");
                    }}
                    className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-primary transition-all whitespace-nowrap active:scale-95 cursor-pointer text-xs"
                  >
                    Find 5 more papers on quantization
                  </button>
                  <button
                    onClick={() => {
                      setInputMessage("Summarize key methodologies");
                    }}
                    className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-primary transition-all whitespace-nowrap active:scale-95 cursor-pointer text-xs"
                  >
                    Summarize key methodologies
                  </button>
                  <button
                    onClick={() => {
                      setInputMessage("Filter by code availability");
                    }}
                    className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-primary transition-all whitespace-nowrap active:scale-95 cursor-pointer text-xs"
                  >
                    Filter by code availability
                  </button>
                </div>

                {/* Input Box Container */}
                <form
                  onSubmit={handleSendMessage}
                  className="relative bg-surface-container rounded-xl border border-outline-variant/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all p-2 flex flex-col gap-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-outline pl-1 pt-0.5 text-[20px] shrink-0">
                      search
                    </span>
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={inputMessage}
                      onChange={(e) => {
                        setInputMessage(e.target.value);
                        adjustTextareaHeight();
                      }}
                      onKeyDown={handleKeyDown}
                      className="w-full bg-transparent border-0 text-on-surface placeholder:text-outline text-body-md focus:ring-0 p-0 focus:outline-none resize-none custom-scrollbar min-h-[24px] max-h-[200px] leading-relaxed"
                      placeholder="Ask for papers, request downloads (e.g. 'Download papers 2 and 6'), or explore concepts... (Shift + Enter for new line)"
                    />
                  </div>

                  {/* Input Toolbar & Controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20 px-1">
                    {/* Left Source Badges & Limit dropdown */}
                    <div className="flex items-center gap-2">
                      {/* Sources Dropdown */}
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSourcesMenuOpen(!isSourcesMenuOpen);
                            setIsLimitMenuOpen(false);
                            setIsYearMenuOpen(false);
                          }}
                          className="flex items-center gap-1.5 text-code-sm font-code-sm text-on-surface-variant bg-surface-container-low hover:bg-surface-container px-2.5 py-1 rounded-lg border border-outline-variant/30 text-xs transition-colors shadow-sm cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px] text-primary">
                            database
                          </span>
                          <span className="font-medium">
                            {activeSourcesSummary}
                          </span>
                          <span className="material-symbols-outlined text-[14px] text-outline">
                            expand_more
                          </span>
                        </button>

                        {isSourcesMenuOpen && (
                          <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-2.5 z-30 flex flex-col gap-1.5 backdrop-blur-md">
                            <div className="flex items-center justify-between px-1.5 py-1 border-b border-outline-variant/20 mb-0.5">
                              <span className="text-[11px] font-code-sm uppercase tracking-wider text-outline font-semibold">
                                Literature Sources
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => selectAllSources(true)}
                                  className={`text-[10px] font-code-sm px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                    activeSourcesCount === sources.length
                                      ? "bg-primary/20 text-primary font-medium border border-primary/30"
                                      : "text-outline hover:text-on-surface bg-surface-container hover:bg-surface-container-highest"
                                  }`}
                                >
                                  All ({sources.length})
                                </button>
                              </div>
                            </div>
                            {sources.map((src) => (
                              <label
                                key={src.id}
                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs border ${
                                  src.checked
                                    ? "bg-surface-container border-primary/25 hover:bg-surface-container-highest"
                                    : "bg-surface-container-low border-outline-variant/20 opacity-60 hover:opacity-100 hover:bg-surface-container"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={src.checked}
                                    onChange={() => toggleSource(src.id)}
                                    className="rounded bg-surface-container-highest border-outline-variant/40 text-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-on-surface font-medium leading-tight">
                                      {src.name}
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant font-code-sm">
                                      {src.sub}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={`text-[9px] font-code-sm px-1.5 py-0.5 rounded border ${
                                    src.checked
                                      ? "bg-primary/10 text-primary border-primary/20"
                                      : "bg-surface-container text-outline border-outline-variant/20"
                                  }`}
                                >
                                  {src.checked ? "Active" : "Excluded"}
                                </span>
                              </label>
                            ))}
                            <div className="px-1.5 pt-1 text-[10px] text-outline leading-tight border-t border-outline-variant/10">
                              Chatbot will search only within {activeSourcesCount === 1 ? `the selected source (${sources.find(s => s.checked)?.name})` : "your selected sources"}.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Paper Limit Dropdown */}
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() => {
                            setIsLimitMenuOpen(!isLimitMenuOpen);
                            setIsSourcesMenuOpen(false);
                            setIsYearMenuOpen(false);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-code-sm font-code-sm text-xs text-outline transition-colors shadow-sm cursor-pointer"
                        >
                          <span>Limit:</span>
                          <span className="text-primary font-semibold">
                            {paperLimit} papers
                          </span>
                          <span className="material-symbols-outlined text-[14px] text-outline">
                            expand_more
                          </span>
                        </button>

                        {isLimitMenuOpen && (
                          <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-3 z-50 text-xs flex flex-col gap-2.5 backdrop-blur-md">
                            <div className="flex items-center justify-between pb-1.5 border-b border-outline-variant/20">
                              <span className="text-[11px] font-code-sm uppercase tracking-wider text-outline font-semibold">
                                Max Paper Results
                              </span>
                              <span className="text-[10px] font-code-sm text-primary">
                                Presets
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[5, 10, 15, 20, 25, 50].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => {
                                    setPaperLimit(num);
                                    setCustomLimitInput(String(num));
                                    setIsLimitMenuOpen(false);
                                  }}
                                  className={`px-2 py-1 rounded-lg text-center font-code-sm text-xs transition-colors border cursor-pointer ${
                                    paperLimit === num
                                      ? "bg-primary/20 text-primary font-semibold border-primary/30"
                                      : "bg-surface-container hover:bg-primary/20 hover:text-primary text-on-surface border-outline-variant/20"
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                            <div className="pt-1.5 border-t border-outline-variant/20 flex flex-col gap-1.5">
                              <label className="text-[10px] font-code-sm text-outline uppercase tracking-wider">
                                Custom Limit
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={customLimitInput}
                                  onChange={(e) => setCustomLimitInput(e.target.value)}
                                  className="w-full bg-surface-container-lowest/80 border border-outline-variant/30 rounded-lg px-2 py-1 text-code-sm font-code-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:border-primary text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = parseInt(customLimitInput, 10);
                                    if (!isNaN(val) && val >= 1) {
                                      setPaperLimit(val);
                                      setIsLimitMenuOpen(false);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary font-medium text-xs font-label-md transition-all active:scale-95 shadow-sm shrink-0 cursor-pointer"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Year Range Dropdown (Right side of Limit papers) */}
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() => {
                            setIsYearMenuOpen(!isYearMenuOpen);
                            setIsLimitMenuOpen(false);
                            setIsSourcesMenuOpen(false);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-code-sm font-code-sm text-xs text-outline transition-colors shadow-sm cursor-pointer"
                          title="Filter papers by publication year range"
                        >
                          <span className="material-symbols-outlined text-[15px] text-tertiary">
                            calendar_month
                          </span>
                          <span>Years:</span>
                          <span className="text-tertiary font-semibold">
                            {startYear} - {endYear}
                          </span>
                          <span className="material-symbols-outlined text-[14px] text-outline">
                            expand_more
                          </span>
                        </button>

                        {isYearMenuOpen && (
                          <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-3 z-50 text-xs flex flex-col gap-2.5 backdrop-blur-md">
                            {/* Year Menu Header */}
                            <div className="flex items-center justify-between pb-1.5 border-b border-outline-variant/20">
                              <span className="text-[11px] font-code-sm uppercase tracking-wider text-outline font-semibold">
                                Publication Year Range
                              </span>
                              <span className="text-[10px] font-code-sm text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded border border-tertiary/20">
                                {startYear} - {endYear}
                              </span>
                            </div>

                            {/* Presets Grid */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-code-sm text-outline uppercase tracking-wider">
                                Quick Presets
                              </span>
                              <div className="grid grid-cols-2 gap-1.5">
                                {[
                                  { label: "2023 - 2026 (Default)", start: 2023, end: 2026 },
                                  { label: "2024 - 2026 (Last 2Y)", start: 2024, end: 2026 },
                                  { label: "2025 - 2026 (Last 1Y)", start: 2025, end: 2026 },
                                  { label: "2021 - 2026 (Last 5Y)", start: 2021, end: 2026 },
                                  { label: "2018 - 2026 (Recent)", start: 2018, end: 2026 },
                                  { label: "All Years (1990+)", start: 1990, end: 2026 },
                                ].map((preset) => {
                                  const isActive =
                                    startYear === preset.start && endYear === preset.end;
                                  return (
                                    <button
                                      key={preset.label}
                                      type="button"
                                      onClick={() => {
                                        setStartYear(preset.start);
                                        setEndYear(preset.end);
                                        setStartYearInput(String(preset.start));
                                        setEndYearInput(String(preset.end));
                                        setIsYearMenuOpen(false);
                                      }}
                                      className={`px-2 py-1 rounded-lg text-left font-code-sm text-[11px] transition-colors border cursor-pointer truncate ${
                                        isActive
                                          ? "bg-tertiary/20 text-tertiary font-semibold border-tertiary/30"
                                          : "bg-surface-container hover:bg-tertiary/15 hover:text-tertiary text-on-surface border-outline-variant/20"
                                      }`}
                                    >
                                      {preset.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Custom Year Inputs */}
                            <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-2">
                              <span className="text-[10px] font-code-sm text-outline uppercase tracking-wider">
                                Custom Window
                              </span>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-code-sm text-outline block mb-0.5">
                                    Start Year
                                  </label>
                                  <input
                                    type="number"
                                    min={1950}
                                    max={2026}
                                    value={startYearInput}
                                    onChange={(e) => setStartYearInput(e.target.value)}
                                    className="w-full bg-surface-container-lowest/80 border border-outline-variant/30 rounded-lg px-2 py-1 text-code-sm font-code-sm text-on-surface focus:outline-none focus:border-tertiary text-xs"
                                    placeholder="2023"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-code-sm text-outline block mb-0.5">
                                    End Year
                                  </label>
                                  <input
                                    type="number"
                                    min={1950}
                                    max={2026}
                                    value={endYearInput}
                                    onChange={(e) => setEndYearInput(e.target.value)}
                                    className="w-full bg-surface-container-lowest/80 border border-outline-variant/30 rounded-lg px-2 py-1 text-code-sm font-code-sm text-on-surface focus:outline-none focus:border-tertiary text-xs"
                                    placeholder="2026"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStartYear(2023);
                                    setEndYear(2026);
                                    setStartYearInput("2023");
                                    setEndYearInput("2026");
                                    setIsYearMenuOpen(false);
                                  }}
                                  className="text-[11px] font-code-sm text-outline hover:text-on-surface hover:underline cursor-pointer"
                                >
                                  Reset (2023-2026)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const s = parseInt(startYearInput, 10);
                                    const e = parseInt(endYearInput, 10);
                                    if (!isNaN(s) && !isNaN(e) && s <= e) {
                                      setStartYear(s);
                                      setEndYear(e);
                                      setIsYearMenuOpen(false);
                                    } else {
                                      alert("Start year must be less than or equal to End year.");
                                    }
                                  }}
                                  className="px-3 py-1 rounded-lg bg-tertiary hover:bg-tertiary-fixed text-on-tertiary font-medium text-xs font-label-md transition-all active:scale-95 shadow-sm cursor-pointer"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="p-1.5 text-outline hover:text-on-surface rounded hover:bg-surface-container-high transition-colors cursor-pointer"
                        title="Attach Paper or BibTeX"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          attach_file
                        </span>
                      </button>
                      <button
                        type="submit"
                        disabled={isSearching || isDownloading || isSynthesizing || isGeneratingDoc || !inputMessage.trim()}
                        className={`px-4 py-1.5 rounded-lg font-medium text-label-md font-label-md transition-all flex items-center gap-1.5 shadow-sm ${
                          isSearching || isDownloading || isSynthesizing || isGeneratingDoc || !inputMessage.trim()
                            ? "bg-surface-container-high text-outline cursor-not-allowed opacity-60"
                            : "bg-primary text-on-primary hover:bg-primary-fixed-dim cursor-pointer active:scale-95"
                        }`}
                      >
                        {isSearching || isDownloading ? (
                          <>
                            <span className={`material-symbols-outlined text-[16px] animate-spin ${isDownloading ? "text-sky-400" : "text-emerald-400"}`}>
                              {isDownloading ? "downloading" : "sync"}
                            </span>
                            <span className={isDownloading ? "text-sky-300" : "text-emerald-300"}>
                              {isDownloading ? "Downloading..." : "Searching..."}
                            </span>
                          </>
                        ) : isSynthesizing ? (
                          <>
                            <span className="material-symbols-outlined text-[16px] animate-spin text-purple-400">
                              autorenew
                            </span>
                            <span className="text-purple-300">Thinking...</span>
                          </>
                        ) : isGeneratingDoc ? (
                          <>
                            <span className="material-symbols-outlined text-[16px] animate-spin text-amber-400">
                              sync
                            </span>
                            <span className="text-amber-300">Typesetting...</span>
                          </>
                        ) : (
                          <>
                            <span>Send</span>
                            <span className="material-symbols-outlined text-[16px]">send</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Footer Compliance Microcopy */}
                {/*
                <div className="flex items-center justify-between text-[11px] font-code-sm text-outline px-1">
                  <span>
                    SupervisorX v4.2 Semantic Engine • Zero Hallucination Retrieval Grounded in OpenAccess Datasets
                  </span>
                  <span>Context: 12.4k / 32k tokens used</span>
                </div> */}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ========================================== */}
      {/* RENAME CHAT TITLE MODAL DIALOG             */}
      {/* ========================================== */}
      {isRenameModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsRenameModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-200"
        >
          <div className="w-full max-w-[480px] rounded-2xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-5 transform transition-transform duration-200 scale-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-base font-semibold text-on-surface">
                  Rename Conversation
                </h3>
              </div>
              <button
                onClick={() => setIsRenameModalOpen(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="flex flex-col gap-3">
              <label className="text-label-md font-label-md text-on-surface-variant font-medium text-xs flex justify-between items-center">
                <span>Chat Conversation Title</span>
                <span className="text-outline text-[11px]">
                  {renameInputTitle.length}/80
                </span>
              </label>
              <div className="relative">
                <input
                  autoFocus
                  maxLength={80}
                  value={renameInputTitle}
                  onChange={(e) => setRenameInputTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveRenamedTitle();
                    } else if (e.key === "Escape") {
                      setIsRenameModalOpen(false);
                    }
                  }}
                  className="w-full bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3.5 py-2.5 text-body-md font-body-md text-on-surface placeholder:text-outline text-sm transition-all shadow-inner"
                  placeholder="Enter conversation title..."
                  type="text"
                />
              </div>
              <p className="text-code-sm font-code-sm text-outline text-[11px]">
                Renaming updates your research workspace session label and semantic index.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-outline-variant/30 text-label-md font-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all active:scale-95 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRenamedTitle}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-label-md font-label-md font-medium transition-all shadow-sm active:scale-95 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
