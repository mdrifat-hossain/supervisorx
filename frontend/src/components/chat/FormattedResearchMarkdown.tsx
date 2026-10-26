"use client";

import React from "react";
import katex from "katex";

interface FormattedMarkdownProps {
  content: string;
}

export default function FormattedResearchMarkdown({ content }: FormattedMarkdownProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];

  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Display Math Blocks $$ ... $$
    if (trimmed.startsWith("$$")) {
      let mathLines: string[] = [];
      if (trimmed === "$$") {
        i++;
        while (i < lines.length && !lines[i].trim().endsWith("$$")) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const closing = lines[i].trim().replace(/\$\$$/, "");
          if (closing) mathLines.push(closing);
          i++;
        }
      } else if (trimmed.endsWith("$$") && trimmed.length > 4) {
        mathLines.push(trimmed.slice(2, -2).trim());
        i++;
      } else {
        mathLines.push(trimmed.slice(2));
        i++;
        while (i < lines.length && !lines[i].trim().includes("$$")) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const parts = lines[i].split("$$");
          if (parts[0]) mathLines.push(parts[0]);
          i++;
        }
      }

      const latexContent = mathLines.join("\n").trim();
      let renderedHtml = "";
      try {
        renderedHtml = katex.renderToString(latexContent, {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        renderedHtml = "";
      }

      blocks.push(
        <div
          key={blockKey++}
          className="my-3 py-2 px-3 overflow-x-auto rounded-xl bg-surface-container-low/80 border border-outline-variant/25 text-center text-on-surface shadow-xs"
        >
          {renderedHtml ? (
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          ) : (
            <pre className="font-mono text-xs text-primary">$${latexContent}$$</pre>
          )}
        </div>
      );
      continue;
    }

    // 2. Code blocks ```
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      const lang = trimmed.replace(/^```/, "").trim();
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <div key={blockKey++} className="my-3 rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-lowest shadow-xs">
          {lang && (
            <div className="px-3 py-1 bg-surface-container border-b border-outline-variant/20 text-[11px] font-mono text-outline uppercase tracking-wider">
              {lang}
            </div>
          )}
          <pre className="p-3 text-xs font-mono overflow-x-auto text-on-surface leading-relaxed">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 3. Markdown Tables (| ... |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0].split("|").slice(1, -1).map((s) => s.trim());
        const bodyRows = tableLines.slice(2).map((rowStr) =>
          rowStr.split("|").slice(1, -1).map((s) => s.trim())
        );

        blocks.push(
          <div key={blockKey++} className="my-4 overflow-x-auto rounded-xl border border-outline-variant/30 shadow-sm bg-surface-container-low/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant/30 text-primary font-semibold">
                  {headerRow.map((h, hIdx) => (
                    <th key={hIdx} className="p-3 border-r last:border-r-0 border-outline-variant/20 whitespace-nowrap">
                      {renderInlineText(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-surface-container-high/40 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3 border-r last:border-r-0 border-outline-variant/15 text-on-surface leading-relaxed align-top">
                        {renderInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 4. Headings (#, ##, ###, ####)
    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={blockKey++} className="text-xl font-bold font-headline-md text-on-surface mt-4 mb-2 pb-1 border-b border-outline-variant/20">
          {renderInlineText(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={blockKey++} className="text-base font-bold font-headline-md text-primary mt-3.5 mb-1.5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
          {renderInlineText(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={blockKey++} className="text-sm font-semibold text-on-surface mt-3 mb-1">
          {renderInlineText(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("#### ")) {
      blocks.push(
        <h4 key={blockKey++} className="text-xs font-semibold uppercase tracking-wider text-outline mt-2 mb-1">
          {renderInlineText(line.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    // 5. Blockquotes (> ...)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={blockKey++} className="my-2.5 pl-3.5 py-1.5 border-l-2 border-primary/60 bg-surface-container-low/50 rounded-r-lg text-xs md:text-sm text-on-surface-variant italic leading-relaxed">
          {renderInlineText(quoteLines.join(" "))}
        </blockquote>
      );
      continue;
    }

    // 6. Numbered lists (1. , 2. )
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      const numItems: { num: string; text: string }[] = [];
      while (i < lines.length) {
        const match = lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (!match) break;
        numItems.push({ num: match[2], text: match[3] });
        i++;
      }
      blocks.push(
        <ol key={blockKey++} className="my-2.5 space-y-1.5 pl-1">
          {numItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-on-surface text-xs md:text-sm leading-relaxed">
              <span className="font-mono text-primary font-bold text-xs shrink-0 mt-0.5 min-w-[1.2rem]">
                {item.num}.
              </span>
              <span className="flex-1">{renderInlineText(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 7. Bullet lists (- or *)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <ul key={blockKey++} className="my-2.5 space-y-1.5 pl-1">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="flex items-start gap-2 text-on-surface text-xs md:text-sm leading-relaxed">
              <span className="material-symbols-outlined text-primary text-[14px] shrink-0 mt-0.5">
                arrow_right
              </span>
              <span className="flex-1">{renderInlineText(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Blank line
    if (!trimmed) {
      i++;
      continue;
    }

    // 9. Regular Paragraph
    blocks.push(
      <p key={blockKey++} className="text-on-surface text-xs md:text-sm leading-relaxed my-2">
        {renderInlineText(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{blocks}</div>;
}

/**
 * Parses inline formatting:
 * - Citations: [1], [2], [1, 2]
 * - Inline Math: $...$
 * - Bold: **text**
 * - Italic: *text* or _text_
 * - Inline code: `code`
 * - Links: [label](url)
 */
function renderInlineText(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  // Tokenize regex matching:
  // 1. Citation: \[\d+(?:,\s*\d+)*\]
  // 2. Inline Math: \$[^$\n]+\$
  // 3. Bold: \*\*[^*]+\*\*
  // 4. Code: `[^`]+`
  // 5. Italic: \*[^*]+\* or _[^_]+_
  // 6. Link: \[[^\]]+\]\(https?:\/\/[^\s)]+\)
  const regex = /(\[\d+(?:,\s*\d+)*\]|\$[^$\n]+\$|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];

    // Citation badge [1]
    if (/^\[\d+(?:,\s*\d+)*\]$/.test(token)) {
      parts.push(
        <span
          key={`cit-${match.index}`}
          className="inline-flex items-center justify-center px-1.5 py-0.2 mx-0.5 rounded text-[11px] font-mono font-bold bg-primary/20 text-primary border border-primary/40 select-none shadow-xs"
          title={`Traceable citation ${token}`}
        >
          {token}
        </span>
      );
    }
    // Inline Math $...$
    else if (token.startsWith("$") && token.endsWith("$") && token.length > 2) {
      const latex = token.slice(1, -1);
      let mathHtml = "";
      try {
        mathHtml = katex.renderToString(latex, {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        mathHtml = "";
      }

      if (mathHtml) {
        parts.push(
          <span
            key={`math-${match.index}`}
            className="inline-math px-0.5"
            dangerouslySetInnerHTML={{ __html: mathHtml }}
          />
        );
      } else {
        parts.push(
          <code key={`math-fallback-${match.index}`} className="px-1 py-0.2 rounded bg-surface-container font-mono text-[11px] text-primary">
            {token}
          </code>
        );
      }
    }
    // Bold **text**
    else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold text-on-surface">
          {token.slice(2, -2)}
        </strong>
      );
    }
    // Code `text`
    else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={`c-${match.index}`} className="px-1 py-0.2 rounded bg-surface-container font-mono text-[11px] text-primary border border-outline-variant/30">
          {token.slice(1, -1)}
        </code>
      );
    }
    // Italic *text* or _text_
    else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      parts.push(
        <em key={`i-${match.index}`} className="italic text-on-surface-variant">
          {token.slice(1, -1)}
        </em>
      );
    }
    // Link [text](url)
    else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={`a-${match.index}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
          >
            {linkMatch[1]}
            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
          </a>
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
