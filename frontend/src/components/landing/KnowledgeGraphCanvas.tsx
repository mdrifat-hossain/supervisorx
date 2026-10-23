"use client";

import { useEffect, useRef } from "react";

export default function KnowledgeGraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 1200;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    resize();
    window.addEventListener("resize", resize);

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      label?: string;
    }

    const labels = [
      "Attention",
      "Transformer",
      "Loss Curve",
      "Encoder",
      "BERT",
      "Embedding",
      "Latent Space",
      "LoRA",
      "AdamW",
      "Gradient",
      "Diffusion",
      "Qdrant",
      "PyMuPDF",
      "arXiv",
    ];

    const nodes: Node[] = [];
    const count = 36;

    for (let i = 0; i < count; i++) {
      const isSpecial = i < labels.length;
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: isSpecial ? 5 : Math.random() * 2.5 + 1.5,
        color: isSpecial
          ? i % 2 === 0
            ? "#adc6ff"
            : "#d0bcff"
          : "rgba(173, 198, 255, 0.4)",
        label: isSpecial ? labels[i] : undefined,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background grid lines subtly
      ctx.strokeStyle = "rgba(42, 53, 72, 0.25)";
      ctx.lineWidth = 1;
      const gridSize = 48;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        n1.x += n1.vx;
        n1.y += n1.vy;
        if (n1.x < 10 || n1.x > canvas.width - 10) n1.vx *= -1;
        if (n1.y < 10 || n1.y > canvas.height - 10) n1.vy *= -1;

        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 140) {
            const alpha = 1 - dist / 140;
            ctx.strokeStyle = `rgba(173, 198, 255, ${alpha * 0.25})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();

        if (n.label) {
          // Glow
          ctx.shadowColor = n.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.font = "11px 'JetBrains Mono', monospace";
          ctx.fillStyle = "rgba(216, 227, 251, 0.75)";
          ctx.fillText(n.label, n.x + 8, n.y + 4);
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}
