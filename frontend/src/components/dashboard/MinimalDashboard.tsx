"use client";

import { useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/common/AppSidebar";

interface StickyNote {
  id: string;
  category: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  borderColor: string;
  topBarColor: string;
  title: string;
  description: string;
  footerLeft: string;
  footerRight: string;
  footerRightColor: string;
  colorType: "amber" | "emerald" | "sky" | "purple";
}

const initialNotes: StickyNote[] = [
  {
    id: "1",
    category: "Pending Warning",
    badgeBg: "bg-amber-500/20",
    badgeText: "text-amber-300",
    badgeBorder: "border-amber-500/30",
    borderColor: "border-amber-500/40 hover:border-amber-500/60",
    topBarColor: "bg-amber-400",
    title: "Calibrate GPU Cluster #4",
    description:
      "Gradient checkpointing memory overflow detected on worker 03. Throttle batch to 16 before midnight run.",
    footerLeft: "Node: us-east-2",
    footerRight: "High Priority",
    footerRightColor: "text-amber-400",
    colorType: "amber",
  },
  {
    id: "2",
    category: "Completed",
    badgeBg: "bg-emerald-500/20",
    badgeText: "text-emerald-300",
    badgeBorder: "border-emerald-500/30",
    borderColor: "border-emerald-500/40 hover:border-emerald-500/60",
    topBarColor: "bg-emerald-400",
    title: "Bio-neural Training Alpha",
    description:
      "Attention map convergence achieved with loss < 0.042. Weights published to registry v2.1.0.",
    footerLeft: "Synced 18m ago",
    footerRight: "Verified",
    footerRightColor: "text-emerald-400",
    colorType: "emerald",
  },
  {
    id: "3",
    category: "Information",
    badgeBg: "bg-sky-500/20",
    badgeText: "text-sky-300",
    badgeBorder: "border-sky-500/30",
    borderColor: "border-sky-500/40 hover:border-sky-500/60",
    topBarColor: "bg-sky-400",
    title: "NeuraLink Benchmark Review",
    description:
      "Dr. Thorne: please review the cross-entropy latency table before sending to external peer panel.",
    footerLeft: "Due: 22:00 UTC",
    footerRight: "In Review",
    footerRightColor: "text-sky-400",
    colorType: "sky",
  },
  {
    id: "4",
    category: "Hypothesis / Idea",
    badgeBg: "bg-purple-500/20",
    badgeText: "text-purple-300",
    badgeBorder: "border-purple-500/30",
    borderColor: "border-purple-500/40 hover:border-purple-500/60",
    topBarColor: "bg-purple-400",
    title: "Entropy Decay on Llama 3",
    description:
      "Inject dynamic temperature perturbation into layer 28-32 to study stochastic resonance under dense context.",
    footerLeft: "Idea Lab",
    footerRight: "Experimental",
    footerRightColor: "text-purple-300",
    colorType: "purple",
  },
];

export default function MinimalDashboard() {
  const [notes, setNotes] = useState<StickyNote[]>(initialNotes);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedPalette, setSelectedPalette] = useState<"amber" | "emerald" | "sky" | "purple">("amber");
  const [activeNav, setActiveNav] = useState("Dashboard");

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const paletteConfig = {
      amber: {
        category: "Pending Warning",
        badgeBg: "bg-amber-500/20",
        badgeText: "text-amber-300",
        badgeBorder: "border-amber-500/30",
        borderColor: "border-amber-500/40 hover:border-amber-500/60",
        topBarColor: "bg-amber-400",
        footerRightColor: "text-amber-400",
      },
      emerald: {
        category: "Completed",
        badgeBg: "bg-emerald-500/20",
        badgeText: "text-emerald-300",
        badgeBorder: "border-emerald-500/30",
        borderColor: "border-emerald-500/40 hover:border-emerald-500/60",
        topBarColor: "bg-emerald-400",
        footerRightColor: "text-emerald-400",
      },
      sky: {
        category: "Information",
        badgeBg: "bg-sky-500/20",
        badgeText: "text-sky-300",
        badgeBorder: "border-sky-500/30",
        borderColor: "border-sky-500/40 hover:border-sky-500/60",
        topBarColor: "bg-sky-400",
        footerRightColor: "text-sky-400",
      },
      purple: {
        category: "Hypothesis / Idea",
        badgeBg: "bg-purple-500/20",
        badgeText: "text-purple-300",
        badgeBorder: "border-purple-500/30",
        borderColor: "border-purple-500/40 hover:border-purple-500/60",
        topBarColor: "bg-purple-400",
        footerRightColor: "text-purple-300",
      },
    }[selectedPalette];

    const newNoteItem: StickyNote = {
      id: Date.now().toString(),
      title: newTitle,
      description: newDesc || "No details provided.",
      footerLeft: "Just now",
      footerRight: "Active",
      colorType: selectedPalette,
      ...paletteConfig,
    };

    setNotes((prev) => [...prev, newNoteItem]);
    setNewTitle("");
    setNewDesc("");
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-on-background font-body-md selection:bg-primary/30 antialiased">
      {/* Left Sidebar (Common AppSidebar) */}
      <AppSidebar activeTab="Dashboard" />

      {/* Main Dashboard Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-background">
        {/* Header/TopBar */}
        <header className="sticky top-0 z-10 flex justify-between items-center px-xl py-lg bg-background/80 backdrop-blur-md">
          <div className="flex flex-col">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Research Overview</h1>
            <p className="font-body-md text-on-surface-variant">
              Welcome back, Dr. Thorne. Your analysis engine is 98% complete.
            </p>
          </div>
          <div className="flex items-center gap-md">
            <button className="bg-surface-container-high hover:bg-surface-variant border border-outline-variant/30 text-on-surface font-label-md px-lg py-sm rounded-xl transition-all active:scale-95 flex items-center gap-sm cursor-pointer">
              <span className="material-symbols-outlined text-md">upload</span>
              Upload Paper
            </button>
          </div>
        </header>

        <div className="px-xl pb-2xl space-y-xl max-w-7xl">
          {/* System Resource Monitor */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-sm">
            <div className="bg-surface-container-low border border-outline-variant/20 px-md py-sm rounded-xl">
              <div className="font-code-sm text-on-surface-variant uppercase text-[10px] tracking-widest mb-1">
                CPU Usage
              </div>
              <div className="font-label-md text-[16px] text-on-surface">42%</div>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/20 px-md py-sm rounded-xl">
              <div className="font-code-sm text-on-surface-variant uppercase text-[10px] tracking-widest mb-1">
                RAM Usage
              </div>
              <div className="font-label-md text-[16px] text-on-surface">12.4GB / 32GB</div>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/20 px-md py-sm rounded-xl">
              <div className="font-code-sm text-on-surface-variant uppercase text-[10px] tracking-widest mb-1">
                GPU Usage
              </div>
              <div className="font-label-md text-[16px] text-on-surface">18%</div>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/20 px-md py-sm rounded-xl">
              <div className="font-code-sm text-on-surface-variant uppercase text-[10px] tracking-widest mb-1">
                Free Space
              </div>
              <div className="font-label-md text-[16px] text-on-surface">2.1 TB</div>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/20 px-md py-sm rounded-xl">
              <div className="font-code-sm text-on-surface-variant uppercase text-[10px] tracking-widest mb-1">
                Active Projects
              </div>
              <div className="font-label-md text-[16px] text-primary">4 Running</div>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/20 px-md py-sm rounded-xl">
              <div className="font-code-sm text-on-surface-variant uppercase text-[10px] tracking-widest mb-1">
                Datasets Linked
              </div>
              <div className="font-label-md text-[16px] text-tertiary">12 Linked</div>
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
                  <div className="flex items-center gap-sm">
                    <h3 className="font-headline-md text-[18px] text-on-surface font-bold">
                      Continuity Sticky Notes &amp; Session Memory
                    </h3>
                    <span className="px-sm py-0.5 rounded-full text-[10px] font-code-sm bg-primary/20 text-primary border border-primary/40 uppercase tracking-wider">
                      {notes.length} Pinned
                    </span>
                    <span className="px-sm py-0.5 rounded-full text-[10px] font-code-sm bg-tertiary/20 text-tertiary border border-tertiary/40 uppercase tracking-wider">
                      Node Synced
                    </span>
                  </div>
                  <p className="font-code-sm text-[11px] text-on-surface-variant mt-0.5">
                    Quick handovers, experiment hypotheses, and critical checkpoint reminders
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-xs">
                <button className="px-sm py-1 rounded-lg bg-surface-container-high border border-outline-variant/30 hover:bg-surface-variant text-on-surface font-label-md text-[12px] flex items-center gap-xs transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-[15px]">filter_list</span>
                  <span>Filter</span>
                </button>
                <button className="px-sm py-1 rounded-lg bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 font-label-md text-[12px] flex items-center gap-xs transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-[15px]">push_pin</span>
                  <span>Pin Board</span>
                </button>
              </div>
            </div>

            {/* Notes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`rounded-xl p-md flex flex-col justify-between transition-all relative group bg-surface-container-highest/30 border ${note.borderColor}`}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${note.topBarColor}`}></div>
                  <div className="space-y-xs pt-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-code-sm font-bold uppercase tracking-wider ${note.badgeBg} ${note.badgeText} border ${note.badgeBorder}`}
                      >
                        {note.category}
                      </span>
                      <div className="flex items-center gap-1 text-on-surface-variant group-hover:text-on-surface">
                        <span
                          className={`material-symbols-outlined text-[15px] cursor-pointer hover:${note.badgeText}`}
                          title="Pinned"
                        >
                          push_pin
                        </span>
                        <span
                          className="material-symbols-outlined text-[15px] cursor-pointer hover:text-primary"
                          title="Edit"
                        >
                          edit
                        </span>
                        <span
                          onClick={() => handleDeleteNote(note.id)}
                          className="material-symbols-outlined text-[15px] cursor-pointer hover:text-error"
                          title="Dismiss"
                        >
                          close
                        </span>
                      </div>
                    </div>
                    <h4 className="font-label-md text-[14px] font-semibold text-on-surface pt-1">
                      {note.title}
                    </h4>
                    <p className="font-body-md text-[12px] text-on-surface-variant leading-relaxed">
                      {note.description}
                    </p>
                  </div>
                  <div className="mt-md pt-xs border-t border-outline-variant/10 flex items-center justify-between font-code-sm text-[10px] text-on-surface-variant">
                    <span>{note.footerLeft}</span>
                    <span className={`${note.footerRightColor} font-medium`}>{note.footerRight}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Note Creator Bar */}
            <form
              onSubmit={handleAddNote}
              className="bg-surface-container-highest/20 border border-outline-variant/20 rounded-xl p-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-md"
            >
              <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-sm">
                <div className="flex items-center gap-xs font-label-md text-[13px] text-primary flex-shrink-0">
                  <span className="material-symbols-outlined text-[18px]">note_add</span>
                  <span className="font-medium">+ New Sticky Note:</span>
                </div>
                <input
                  type="text"
                  placeholder="Note title / Category (e.g. Urgent: Check tensor cache)"
                  className="bg-surface-container-high border border-outline-variant/30 text-on-surface font-body-md text-[13px] px-sm py-1.5 rounded-lg flex-1 focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/50"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Short reminder description..."
                  className="bg-surface-container-high border border-outline-variant/30 text-on-surface font-body-md text-[13px] px-sm py-1.5 rounded-lg flex-1 focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/50"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between md:justify-end gap-sm flex-shrink-0">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-container-high/60 rounded-lg border border-outline-variant/20">
                  <span className="font-code-sm text-[10px] text-on-surface-variant mr-1">Palette:</span>
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
                <button
                  type="submit"
                  className="px-md py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-[12px] font-semibold flex items-center gap-xs transition-colors hover:bg-primary-fixed cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Add Note</span>
                </button>
              </div>
            </form>
          </div>

          {/* Research Activity Heatmap */}
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-lg flex flex-col">
            <div className="flex justify-between items-center mb-md">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Research Activity</h3>
                <p className="font-body-md text-[13px] text-on-surface-variant mt-1">
                  Daily interaction intensity across active projects
                </p>
              </div>
              <button className="px-md py-xs bg-surface-container-high border border-outline-variant/30 hover:bg-surface-variant text-on-surface font-label-md text-[12px] rounded-lg transition-all flex items-center gap-xs cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                Expand History
              </button>
            </div>

            {/* Heatmap Legend */}
            <div className="flex gap-md mb-lg">
              <div className="flex items-center gap-xs">
                <div className="w-3 h-3 rounded-sm bg-tertiary opacity-80"></div>
                <span className="font-code-sm text-[11px] text-on-surface-variant">Neural Synthesis V2</span>
              </div>
              <div className="flex items-center gap-xs">
                <div className="w-3 h-3 rounded-sm bg-primary opacity-80"></div>
                <span className="font-code-sm text-[11px] text-on-surface-variant">Quantum Cognition</span>
              </div>
              <div className="flex items-center gap-xs">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(208, 188, 255, 0.8) 0%, rgba(173, 198, 255, 0.8) 100%)",
                  }}
                ></div>
                <span className="font-code-sm text-[11px] text-on-surface-variant">Mixed Focus</span>
              </div>
            </div>

            {/* Heatmap Grid Container */}
            <div className="w-full overflow-x-auto custom-scrollbar pb-sm">
              <div className="inline-flex flex-col gap-1 pr-4">
                {/* Months Row */}
                <div className="flex gap-[44px] pl-6 font-code-sm text-[10px] text-on-surface-variant mb-1">
                  <span>Aug</span>
                  <span>Sep</span>
                  <span>Oct</span>
                  <span>Nov</span>
                </div>
                {/* Monday Row */}
                <div className="flex gap-1 items-center">
                  <span className="font-code-sm text-[9px] text-on-surface-variant w-5 text-right mr-1">
                    Mon
                  </span>
                  <div className="flex gap-1">
                    <div className="heatmap-cell cell-p1-1"></div>
                    <div className="heatmap-cell cell-p1-2"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p2-1"></div>
                    <div className="heatmap-cell cell-p2-3"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p1-2"></div>
                    <div className="heatmap-cell cell-p1-3"></div>
                    <div className="heatmap-cell cell-mixed"></div>
                    <div className="heatmap-cell cell-p2-2"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p2-1"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-mixed"></div>
                    <div className="heatmap-cell cell-p1-2"></div>
                    <div className="heatmap-cell cell-p1-1"></div>
                    <div className="heatmap-cell cell-p2-2"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p1-1"></div>
                    <div className="heatmap-cell cell-mixed"></div>
                  </div>
                </div>

                {/* Wednesday Row */}
                <div className="flex gap-1 items-center">
                  <span className="font-code-sm text-[9px] text-on-surface-variant w-5 text-right mr-1">
                    Wed
                  </span>
                  <div className="flex gap-1">
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p1-3"></div>
                    <div className="heatmap-cell cell-p2-1"></div>
                    <div className="heatmap-cell cell-p2-2"></div>
                    <div className="heatmap-cell cell-mixed"></div>
                    <div className="heatmap-cell cell-p1-1"></div>
                    <div className="heatmap-cell cell-p1-2"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p2-3"></div>
                    <div className="heatmap-cell cell-p2-1"></div>
                    <div className="heatmap-cell cell-mixed"></div>
                    <div className="heatmap-cell cell-p1-2"></div>
                    <div className="heatmap-cell cell-p1-3"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p2-1"></div>
                    <div className="heatmap-cell cell-p2-2"></div>
                    <div className="heatmap-cell cell-mixed"></div>
                    <div className="heatmap-cell cell-p1-1"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p2-3"></div>
                  </div>
                </div>

                {/* Friday Row */}
                <div className="flex gap-1 items-center">
                  <span className="font-code-sm text-[9px] text-on-surface-variant w-5 text-right mr-1">
                    Fri
                  </span>
                  <div className="flex gap-1">
                    <div className="heatmap-cell cell-p2-1"></div>
                    <div className="heatmap-cell cell-mixed"></div>
                    <div className="heatmap-cell cell-p1-2"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p1-1"></div>
                    <div className="heatmap-cell cell-p2-3"></div>
                    <div className="heatmap-cell cell-p2-2"></div>
                    <div className="heatmap-cell cell-p1-3"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-mixed"></div>
                    <div className="heatmap-cell cell-p1-1"></div>
                    <div className="heatmap-cell cell-p2-1"></div>
                    <div className="heatmap-cell cell-p2-2"></div>
                    <div className="heatmap-cell cell-p1-2"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-mixed"></div>
                    <div className="heatmap-cell cell-p1-3"></div>
                    <div className="heatmap-cell cell-p2-1"></div>
                    <div className="heatmap-cell cell-p2-2"></div>
                    <div className="heatmap-cell cell-empty"></div>
                  </div>
                </div>

                {/* Weekend Sparse Row */}
                <div className="flex gap-1 items-center">
                  <span className="font-code-sm text-[9px] text-on-surface-variant w-5 text-right mr-1"></span>
                  <div className="flex gap-1 opacity-70">
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p1-1"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p2-1"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p1-1"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-mixed"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p2-1"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-empty"></div>
                    <div className="heatmap-cell cell-p1-1"></div>
                    <div className="heatmap-cell cell-empty"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Project Activity */}
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-lg">
            <div className="flex justify-between items-center mb-lg">
              <h3 className="font-headline-md text-headline-md text-on-surface">Recent Project Activity</h3>
            </div>
            <div className="space-y-sm">
              {/* Project 1 */}
              <div className="group flex items-center justify-between p-md bg-surface-container-highest/30 border border-outline-variant/10 hover:border-outline-variant/30 rounded-xl transition-all">
                <div className="flex items-center gap-md">
                  <div className="w-2 h-10 bg-tertiary rounded-full"></div>
                  <div>
                    <div className="font-label-md text-[15px] text-on-surface">Neural Synthesis V2</div>
                    <div className="font-body-md text-on-surface-variant text-[13px] mt-0.5">
                      Semantic indexing completed for 114 PDFs.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-lg">
                  <div className="font-code-sm text-[12px] text-on-surface-variant text-right">
                    <div>Last access</div>
                    <div className="text-on-surface mt-0.5">12m ago</div>
                  </div>
                  <Link
                    href="/projects"
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-variant text-on-surface-variant transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </Link>
                </div>
              </div>

              {/* Project 2 */}
              <div className="group flex items-center justify-between p-md bg-surface-container-highest/30 border border-outline-variant/10 hover:border-outline-variant/30 rounded-xl transition-all">
                <div className="flex items-center gap-md">
                  <div className="w-2 h-10 bg-primary rounded-full"></div>
                  <div>
                    <div className="font-label-md text-[15px] text-on-surface">Quantum Cognition</div>
                    <div className="font-body-md text-on-surface-variant text-[13px] mt-0.5">
                      Optimized 12 prompt chains in agentic supervisor.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-lg">
                  <div className="font-code-sm text-[12px] text-on-surface-variant text-right">
                    <div>Last access</div>
                    <div className="text-on-surface mt-0.5">4h ago</div>
                  </div>
                  <Link
                    href="/projects"
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-variant text-on-surface-variant transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </Link>
                </div>
              </div>

              {/* Project 3 */}
              <div className="group flex items-center justify-between p-md bg-surface-container-highest/30 border border-outline-variant/10 hover:border-outline-variant/30 rounded-xl transition-all">
                <div className="flex items-center gap-md">
                  <div className="w-2 h-10 bg-secondary rounded-full"></div>
                  <div>
                    <div className="font-label-md text-[15px] text-on-surface">Cognitive Bio-hacking</div>
                    <div className="font-body-md text-on-surface-variant text-[13px] mt-0.5">
                      Bio-neural_Training_Set_Alpha sanitized and normalized.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-lg">
                  <div className="font-code-sm text-[12px] text-on-surface-variant text-right">
                    <div>Last access</div>
                    <div className="text-on-surface mt-0.5">1d ago</div>
                  </div>
                  <Link
                    href="/projects"
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-variant text-on-surface-variant transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
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
        </footer>
      </main>
    </div>
  );
}
