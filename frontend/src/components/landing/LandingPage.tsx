"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import KnowledgeGraphCanvas from "./KnowledgeGraphCanvas";

export default function LandingPage() {
  const [typedPlaceholder, setTypedPlaceholder] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "ai"; text: string; citation?: string; tags?: string[] }[]
  >([
    {
      role: "user",
      text: "Can you analyze the ablation study in the 'Transformer-XL' paper and tell me why the relative positional encoding was critical?",
    },
    {
      role: "ai",
      text: "Analyzing Transformer-XL (Dai et al., 2019)... The relative positional encoding is critical because it maintains temporal coherence across segment boundaries.",
      citation:
        '"Standard absolute encodings fail to generalize to longer sequences during inference... [Page 4, Section 3.3]"',
      tags: ["PDF-ID: 4192", "SECTION: 3.3"],
    },
  ]);

  // Scroll reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Interactive typewriter simulation
  useEffect(() => {
    const phrases = [
      "Explain Neural ODEs...",
      "Find gaps in LLM reasoning papers...",
      "Generate a PyTorch skeleton for this paper...",
    ];
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;

    const tick = () => {
      const currentPhrase = phrases[phraseIndex];
      if (isDeleting) {
        setTypedPlaceholder(currentPhrase.substring(0, charIndex--));
      } else {
        setTypedPlaceholder(currentPhrase.substring(0, charIndex++));
      }

      if (!isDeleting && charIndex === currentPhrase.length) {
        isDeleting = true;
        timeoutId = setTimeout(tick, 2000);
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        timeoutId = setTimeout(tick, 500);
      } else {
        timeoutId = setTimeout(tick, isDeleting ? 50 : 100);
      }
    };

    timeoutId = setTimeout(tick, 500);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setChatInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Grounded synthesis retrieved across your indexed papers for: "${userText}". All citations verified against primary sources.`,
          citation:
            '"Evidence retrieved with 98.4% precision against document embeddings. [Page 2, Section 1.2]"',
          tags: ["PDF-ID: 5208", "SECTION: 1.2"],
        },
      ]);
    }, 900);
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen overflow-x-hidden selection:bg-primary/30 antialiased">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-outline-variant/30 shadow-sm transition-all duration-300">
        <div className="flex justify-between items-center px-lg py-sm max-w-container-max mx-auto h-16">
          <Link href="/" className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span
                className="material-symbols-outlined text-on-primary text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                sync
              </span>
            </div>
            <span className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
              SupervisorX
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-xl">
            <a
              className="text-primary font-bold border-b-2 border-primary pb-1 font-label-md text-label-md hover:text-primary transition-colors duration-200"
              href="#features"
            >
              Product
            </a>
            <a
              className="text-on-surface-variant font-medium font-label-md text-label-md hover:text-primary transition-colors duration-200"
              href="#features"
            >
              Features
            </a>
            <a
              className="text-on-surface-variant font-medium font-label-md text-label-md hover:text-primary transition-colors duration-200"
              href="#pricing"
            >
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-md">
            <Link
              href="/login"
              className="hidden sm:block text-on-surface-variant font-medium font-label-md text-label-md hover:text-primary transition-all duration-300 active:opacity-80"
            >
              Login
            </Link>
            <Link
              href="/login"
              className="bg-primary text-on-primary px-lg py-sm rounded-lg font-label-md text-label-md font-bold hover:brightness-110 active:scale-95 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] bg-primary/5 blur-[140px] rounded-full"></div>
          <div className="absolute top-[30%] right-[10%] w-[450px] h-[450px] bg-tertiary/5 blur-[120px] rounded-full"></div>
        </div>

        <div className="max-w-container-max mx-auto px-lg relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="reveal active flex flex-col items-start w-full min-w-0">
            <span className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full font-label-md text-xs sm:text-label-md mb-md whitespace-nowrap">
              v2.0 Now Researching
            </span>
            <h1 className="font-display-lg text-4xl sm:text-5xl lg:text-[56px] text-on-background mb-lg leading-[1.15] tracking-tight font-bold">
              Your AI <br className="hidden sm:inline" />
              <span className="text-primary">Research Supervisor</span>
            </h1>
            <p className="font-body-lg text-base sm:text-body-lg text-on-surface-variant mb-xl max-w-[540px] leading-relaxed">
              Analyze papers, understand code, discover research gaps, and accelerate innovation with
              a persistent knowledge memory for researchers.
            </p>
            <div className="flex flex-wrap gap-md items-center">
              <Link
                href="/login"
                className="ai-gradient-bg text-on-primary px-8 py-3.5 rounded-full font-headline-md text-base sm:text-headline-md font-bold flex items-center gap-sm ink-shadow hover:scale-105 active:scale-95 transition-transform"
              >
                Start Research <span className="material-symbols-outlined">bolt</span>
              </Link>
              <a
                href="#demo"
                className="glass-panel text-on-surface border border-outline-variant/30 px-8 py-3.5 rounded-full font-headline-md text-base sm:text-headline-md flex items-center gap-sm hover:bg-surface-container-high transition-colors"
              >
                Watch Demo <span className="material-symbols-outlined">play_circle</span>
              </a>
            </div>
          </div>

          <div className="reveal active delay-200 w-full min-w-0">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-primary/30 to-tertiary/30 rounded-2xl blur-xl opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-300"></div>

              {/* Dashboard Preview Image Container */}
              <div className="relative w-full rounded-2xl glass-panel p-2 sm:p-3 shadow-2xl border border-outline-variant/30 overflow-hidden group">
                <img
                  src="/dashboard-image.png"
                  alt="SupervisorX Research Dashboard Preview"
                  className="w-full h-auto rounded-xl object-cover border border-outline-variant/20 shadow-inner transition-transform duration-500 group-hover:scale-[1.01]"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-xl border-y border-outline-variant/10 bg-surface-container-lowest/50">
        <div className="max-w-container-max mx-auto px-lg">
          <p className="text-center font-label-md text-label-md text-on-surface-variant/60 uppercase tracking-widest mb-lg">
            Accelerating research at
          </p>
          <div className="flex flex-wrap justify-center items-center gap-2xl opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-4xl">school</span>
              <span className="font-headline-md font-bold">Stanford AI</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-4xl">science</span>
              <span className="font-headline-md font-bold">MIT Lab</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-4xl">psychology</span>
              <span className="font-headline-md font-bold">Oxford CogSci</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-4xl">computer</span>
              <span className="font-headline-md font-bold">DeepMind</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-4xl">language</span>
              <span className="font-headline-md font-bold">OpenAI Research</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-2xl max-w-container-max mx-auto px-lg">
        <div className="text-center mb-12 w-full max-w-[850px] mx-auto px-4">
          <h2 className="font-headline-lg text-3xl sm:text-4xl lg:text-[40px] font-bold mb-4 leading-tight text-on-background text-center">
            Augmented Intelligence for Researchers
          </h2>
          <p className="font-body-md text-base sm:text-lg text-on-surface-variant w-full max-w-[720px] mx-auto leading-relaxed text-center">
            Beyond chat. SupervisorX provides the heavy-duty analytical capabilities required for
            high-impact scientific work.
          </p>
        </div>

        <div className="bento-grid">
          {/* Paper Discovery */}
          <div className="col-span-12 md:col-span-8 glass-panel p-lg rounded-xl hover:border-primary/50 transition-colors group">
            <div className="flex flex-col md:flex-row gap-lg items-center">
              <div className="flex-1">
                <span className="material-symbols-outlined text-primary mb-sm">manage_search</span>
                <h3 className="font-headline-md text-headline-md mb-sm">Paper Discovery</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Semantic discovery engine that finds relevant work based on conceptual similarity
                  rather than just keywords. Understands the nuances of specialized subfields.
                </p>
              </div>
              <div className="w-full md:w-64 h-48 bg-surface-container rounded-lg overflow-hidden relative flex items-center justify-center">
                <span className="material-symbols-outlined text-6xl text-primary/20 group-hover:scale-110 transition-transform duration-500">
                  travel_explore
                </span>
              </div>
            </div>
          </div>

          {/* AI Literature Review */}
          <div className="col-span-12 md:col-span-4 glass-panel p-lg rounded-xl hover:border-primary/50 transition-colors">
            <span className="material-symbols-outlined text-primary mb-sm">summarize</span>
            <h3 className="font-headline-md text-headline-md mb-sm">Literature Review</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Synthesize thousands of pages into executive summaries, identifying consensus and
              controversies in seconds.
            </p>
          </div>

          {/* Research Memory */}
          <div className="col-span-12 md:col-span-4 glass-panel p-lg rounded-xl hover:border-primary/50 transition-colors">
            <span className="material-symbols-outlined text-primary mb-sm">memory</span>
            <h3 className="font-headline-md text-headline-md mb-sm">Research Memory</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Your personal AI brain. SupervisorX remembers every paper you&apos;ve read, creating a
              persistent graph of your unique knowledge base.
            </p>
          </div>

          {/* Figure Analysis */}
          <div className="col-span-12 md:col-span-8 glass-panel p-lg rounded-xl hover:border-primary/50 transition-colors group">
            <div className="flex flex-col md:flex-row gap-lg items-center">
              <div className="w-full md:w-64 h-48 bg-surface-container rounded-lg relative overflow-hidden flex items-center justify-center border border-outline-variant/20">
                <div className="p-md text-center">
                  <span className="material-symbols-outlined text-4xl text-primary mb-xs">
                    query_stats
                  </span>
                  <div className="text-xs font-label-md text-primary font-bold">FIGURE EXTRACTION</div>
                  <div className="text-[10px] text-on-surface-variant mt-1">PyMuPDF Neural Parser</div>
                </div>
              </div>
              <div className="flex-1">
                <span className="material-symbols-outlined text-primary mb-sm">query_stats</span>
                <h3 className="font-headline-md text-headline-md mb-sm">Figure Analysis</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Extract data directly from charts and tables. SupervisorX understands the math behind
                  the visuals to verify experimental results.
                </p>
              </div>
            </div>
          </div>

          {/* Code Analysis */}
          <div className="col-span-12 md:col-span-6 lg:col-span-3 glass-panel p-lg rounded-xl hover:border-primary/50 transition-colors">
            <span className="material-symbols-outlined text-primary mb-sm">terminal</span>
            <h3 className="font-headline-md text-headline-md mb-sm">Code Analysis</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Map equations in papers directly to implementation in GitHub repositories.
            </p>
          </div>

          {/* Gap Detection */}
          <div className="col-span-12 md:col-span-6 lg:col-span-3 glass-panel p-lg rounded-xl hover:border-primary/50 transition-colors">
            <span className="material-symbols-outlined text-primary mb-sm">extension</span>
            <h3 className="font-headline-md text-headline-md mb-sm">Gap Detection</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              AI identifies unexplored areas where current literature leaves unanswered questions.
            </p>
          </div>

          {/* Shadow Pipeline */}
          <div className="col-span-12 md:col-span-6 lg:col-span-3 glass-panel p-lg rounded-xl hover:border-primary/50 transition-colors">
            <span className="material-symbols-outlined text-primary mb-sm">auto_graph</span>
            <h3 className="font-headline-md text-headline-md mb-sm">Shadow Pipeline</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Generate automated experiment pipelines from textual descriptions of methodologies.
            </p>
          </div>

          {/* Experiment Tracking */}
          <div className="col-span-12 md:col-span-6 lg:col-span-3 glass-panel p-lg rounded-xl hover:border-primary/50 transition-colors">
            <span className="material-symbols-outlined text-primary mb-sm">monitoring</span>
            <h3 className="font-headline-md text-headline-md mb-sm">Exp Tracking</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Log variables, results, and AI-driven insights in a unified research ledger.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo" className="py-2xl bg-surface-container-low/50">
        <div className="max-w-container-max mx-auto px-lg">
          <div className="grid lg:grid-cols-2 gap-2xl items-center">
            <div className="reveal active">
              <h2 className="font-headline-lg text-headline-lg mb-lg">
                Talk to your research like never before.
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-xl">
                SupervisorX isn&apos;t a general LLM. It&apos;s grounded in the latest scientific
                corpora, ensuring every claim is backed by a citation you can verify.
              </p>
              <div className="space-y-md">
                <div className="flex items-start gap-md">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary">verified</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-on-background">Verifiable Citations</h4>
                    <p className="text-on-surface-variant">
                      Every answer includes direct links to relevant snippets in the source PDF.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-md">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary">psychology</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-on-background">Conceptual Reasoning</h4>
                    <p className="text-on-surface-variant">
                      The AI can bridge the gap between abstract theory and practical implementation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Window */}
            <div className="reveal active glass-panel rounded-xl overflow-hidden shadow-2xl border border-outline-variant/30">
              <div className="bg-surface-container-high px-lg py-sm flex items-center justify-between border-b border-outline-variant/30">
                <div className="flex items-center gap-sm">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  SupervisorX Research Console
                </span>
              </div>

              <div className="p-lg space-y-lg h-[400px] overflow-y-auto">
                {messages.map((m, idx) =>
                  m.role === "user" ? (
                    <div key={idx} className="flex justify-end">
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-md max-w-[80%] text-on-surface">
                        <p className="font-body-md text-body-md">{m.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={idx} className="flex justify-start">
                      <div className="glass-panel rounded-lg p-md max-w-[80%]">
                        <div className="flex items-center gap-xs mb-xs">
                          <span
                            className="material-symbols-outlined text-primary text-sm"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            bolt
                          </span>
                          <span className="font-label-md text-label-md text-primary uppercase font-bold">
                            Supervisor AI
                          </span>
                        </div>
                        <p className="font-body-md text-body-md text-on-surface-variant mb-sm">
                          {m.text}
                        </p>
                        {m.citation && (
                          <div className="bg-surface-container-highest p-sm rounded border border-outline-variant/20 mb-sm">
                            <p className="font-code-sm text-code-sm text-primary">{m.citation}</p>
                          </div>
                        )}
                        {m.tags && (
                          <div className="flex gap-xs">
                            {m.tags.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-xs py-[2px] bg-primary/20 rounded font-label-md text-[10px] text-primary"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="p-lg bg-surface-container border-t border-outline-variant/30">
                <form onSubmit={handleSendMessage} className="relative">
                  <input
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-lg py-sm font-body-md text-body-md text-on-surface input-glow pr-12"
                    placeholder={typedPlaceholder || "Ask about your research..."}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:opacity-80 transition-opacity cursor-pointer p-1"
                    aria-label="Send message"
                  >
                    <span className="material-symbols-outlined">send</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Knowledge Graph Showcase */}
      <section className="py-2xl relative">
        <div className="max-w-container-max mx-auto px-lg">
          <div className="text-center mb-2xl">
            <h2 className="font-headline-lg text-headline-lg">Your Research, Interconnected.</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              SupervisorX automatically builds a knowledge graph as you ingest information.
            </p>
          </div>

          <div className="relative h-[600px] rounded-2xl overflow-hidden glass-panel border border-outline-variant/30">
            {/* Interactive Canvas Graph */}
            <KnowledgeGraphCanvas />

            {/* Overlay UI Previews */}
            <div className="absolute top-10 left-10 glass-panel p-md rounded-lg max-w-[280px] animate-pulse border border-primary/20">
              <h4 className="font-label-md text-label-md font-bold mb-xs text-primary">
                ACTIVE NEURON CLUSTER
              </h4>
              <p className="font-body-md text-body-md opacity-80 text-on-surface">
                94 nodes identified in current project scope. Overlap detected with &apos;Attention
                Mechanisms&apos;.
              </p>
            </div>

            <div className="absolute bottom-10 right-10 glass-panel p-md rounded-lg max-w-[280px] border border-primary/30">
              <div className="flex items-center gap-sm mb-sm">
                <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
                <h4 className="font-label-md text-label-md font-bold text-on-surface">
                  REAL-TIME MEMORY MAPPING
                </h4>
              </div>
              <div className="space-y-xs opacity-70">
                <div className="h-2 bg-primary/40 rounded w-3/4"></div>
                <div className="h-2 bg-primary/30 rounded w-1/2"></div>
                <div className="h-2 bg-primary/50 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-2xl bg-surface-container-low/30">
        <div className="max-w-container-max mx-auto px-lg">
          <h2 className="font-headline-lg text-headline-lg text-center mb-2xl">
            The SupervisorX Edge
          </h2>
          <div className="grid md:grid-cols-2 gap-lg">
            <div className="p-xl rounded-2xl bg-surface-container-lowest border border-outline-variant/10">
              <h3 className="font-headline-md text-headline-md mb-lg text-on-surface-variant/50">
                Traditional Research
              </h3>
              <ul className="space-y-md">
                <li className="flex items-center gap-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-error">close</span>
                  Manual citation management
                </li>
                <li className="flex items-center gap-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-error">close</span>
                  Fragmented knowledge (tabs/folders)
                </li>
                <li className="flex items-center gap-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-error">close</span>
                  Days to synthesize 20+ papers
                </li>
                <li className="flex items-center gap-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-error">close</span>
                  Context lost between projects
                </li>
              </ul>
            </div>

            <div className="p-xl rounded-2xl glass-panel border border-primary/30 ring-1 ring-primary/20 ink-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 p-sm bg-primary text-on-primary font-label-md text-[10px] font-bold uppercase tracking-widest rounded-bl-lg">
                Advanced AI
              </div>
              <h3 className="font-headline-md text-headline-md mb-lg text-primary">
                SupervisorX Workflow
              </h3>
              <ul className="space-y-md">
                <li className="flex items-center gap-sm text-on-surface">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  Automated semantic indexing
                </li>
                <li className="flex items-center gap-sm text-on-surface">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  Unified Research Memory
                </li>
                <li className="flex items-center gap-sm text-on-surface">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  Instant synthesis across library
                </li>
                <li className="flex items-center gap-sm text-on-surface">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  Cross-project insight persistence
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-2xl max-w-container-max mx-auto px-lg">
        <div className="text-center mb-2xl">
          <h2 className="font-headline-lg text-headline-lg">Plans for Every Researcher</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Scale your output with powerful tools designed for academia and industry labs.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-xl">
          {/* Free */}
          <div className="p-2xl rounded-2xl glass-panel border border-outline-variant/20 hover:border-primary/30 transition-all flex flex-col justify-between">
            <div>
              <h3 className="font-headline-md text-headline-md mb-sm">Free</h3>
              <div className="flex items-baseline gap-xs mb-lg">
                <span className="font-display-lg text-headline-lg">$0</span>
                <span className="text-on-surface-variant">/mo</span>
              </div>
              <ul className="space-y-md mb-2xl text-on-surface-variant">
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> 5 paper
                  analyses/mo
                </li>
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> Basic knowledge
                  graph
                </li>
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> Citation export
                </li>
              </ul>
            </div>
            <Link
              href="/login"
              className="w-full py-md rounded-lg border border-outline-variant/30 hover:bg-surface-container font-bold transition-all text-center block"
            >
              Start Free
            </Link>
          </div>

          {/* Research Pro */}
          <div className="p-2xl rounded-2xl glass-panel border-2 border-primary ink-shadow relative transform hover:-translate-y-2 transition-all flex flex-col justify-between">
            <div>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-lg py-xs rounded-full font-label-md text-label-md font-bold uppercase">
                Popular
              </div>
              <h3 className="font-headline-md text-headline-md mb-sm text-primary">Research</h3>
              <div className="flex items-baseline gap-xs mb-lg">
                <span className="font-display-lg text-display-lg">$29</span>
                <span className="text-on-surface-variant">/mo</span>
              </div>
              <ul className="space-y-md mb-2xl">
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> Unlimited paper
                  analyses
                </li>
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> Deep Research
                  Memory
                </li>
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> Code-Paper
                  Mapping
                </li>
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> Shadow Pipeline
                  generation
                </li>
              </ul>
            </div>
            <Link
              href="/login"
              className="w-full py-md rounded-lg ai-gradient-bg text-on-primary font-bold hover:brightness-110 shadow-lg transition-all text-center block"
            >
              Get Pro
            </Link>
          </div>

          {/* Enterprise */}
          <div className="p-2xl rounded-2xl glass-panel border border-outline-variant/20 hover:border-primary/30 transition-all flex flex-col justify-between">
            <div>
              <h3 className="font-headline-md text-headline-md mb-sm">Enterprise</h3>
              <div className="flex items-baseline gap-xs mb-lg">
                <span className="font-display-lg text-headline-lg">Custom</span>
              </div>
              <ul className="space-y-md mb-2xl text-on-surface-variant">
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> Private cloud
                  deployment
                </li>
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> Custom model
                  fine-tuning
                </li>
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> Team collab
                  &amp; SSO
                </li>
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">check</span> API Access
                </li>
              </ul>
            </div>
            <Link
              href="/login"
              className="w-full py-md rounded-lg border border-outline-variant/30 hover:bg-surface-container font-bold transition-all text-center block"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-container-lowest py-2xl border-t border-outline-variant/20">
        <div className="max-w-container-max mx-auto px-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-lg mb-2xl">
            <div className="col-span-2">
              <div className="flex items-center gap-sm mb-md">
                <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    sync
                  </span>
                </div>
                <span className="font-headline-md text-headline-md font-bold text-primary">
                  SupervisorX
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mb-md max-w-[320px]">
                Advanced AI research supervision for the next generation of scientific breakthroughs.
              </p>
            </div>

            <div>
              <h5 className="font-label-md text-label-md font-bold text-on-surface mb-md uppercase tracking-wider">
                Product
              </h5>
              <ul className="space-y-sm text-on-surface-variant font-label-md text-label-md">
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#features">
                    Discovery
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#features">
                    Memory
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#features">
                    Pipelines
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#pricing">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-label-md text-label-md font-bold text-on-surface mb-md uppercase tracking-wider">
                Resources
              </h5>
              <ul className="space-y-sm text-on-surface-variant font-label-md text-label-md">
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#">
                    Documentation
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#">
                    API Reference
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#">
                    Blog
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#">
                    Status
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-label-md text-label-md font-bold text-on-surface mb-md uppercase tracking-wider">
                Company
              </h5>
              <ul className="space-y-sm text-on-surface-variant font-label-md text-label-md">
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#">
                    About Us
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#">
                    Careers
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#">
                    Contact
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary underline-offset-4 hover:underline transition-all" href="#">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-label-md text-label-md font-bold text-on-surface mb-md uppercase tracking-wider">
                Social
              </h5>
              <div className="flex gap-md">
                <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">
                  <span className="material-symbols-outlined">alternate_email</span>
                </a>
                <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">
                  <span className="material-symbols-outlined">forum</span>
                </a>
                <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">
                  <span className="material-symbols-outlined">code</span>
                </a>
              </div>
            </div>
          </div>

          <div className="pt-lg border-t border-outline-variant/10 flex flex-col md:flex-row justify-between items-center gap-md">
            <p className="font-body-md text-body-md text-on-surface-variant/60">
              © 2024 SupervisorX AI Research. All rights reserved.
            </p>
            <div className="flex gap-lg text-on-surface-variant font-label-md text-label-md">
              <a className="hover:text-primary transition-colors" href="#">
                Terms of Service
              </a>
              <a className="hover:text-primary transition-colors" href="#">
                Privacy Policy
              </a>
              <a className="hover:text-primary transition-colors" href="#">
                Cookie Settings
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
