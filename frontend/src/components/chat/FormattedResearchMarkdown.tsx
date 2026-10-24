"use client";

import React from "react";

interface FormattedMarkdownProps {
  content: string;
}

export default function FormattedResearchMarkdown({ content }: FormattedMarkdownProps) {
  if (!content) return null;

  // Split lines into blocks: code, table, heading, list, paragraph
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];

  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code blocks ```
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      const lang = line.trim().replace(/^```/, "").trim();
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <div key={blockKey++} className="my-3 rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-lowest">
          {lang && (
            <div className="px-3 py-1 bg-surface-container border-b border-outline-variant/20 text-xs font-mono text-outline uppercase tracking-wider">
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

    // 2. Markdown Tables (| ... |)
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0].split("|").slice(1, -1).map((s) => s.trim());
        // line 1 is separator |---|---|
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

    // 3. Headings (#, ##, ###)
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

    // 4. Bullet lists (- or *)
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
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

    // 5. Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // 6. Regular Paragraph
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
 * - Bold: **text**
 * - Italic: *text*
 * - Inline code: `code`
 * - Citations: [1], [2], [1, 2]
 */
function renderInlineText(text: string): React.ReactNode {
  if (!text) return null;

  // Tokenize regex for citations, bold, code, italic
  const parts: React.ReactNode[] = [];
  const regex = /(\[\d+(?:,\s*\d+)*\]|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("[") && token.endsWith("]")) {
      // Citation badge! e.g. [1] or [1, 2]
      parts.push(
        <span
          key={match.index}
          className="inline-flex items-center justify-center px-1.5 py-0.2 mx-0.5 rounded text-[11px] font-mono font-bold bg-primary/20 text-primary border border-primary/40 select-none shadow-xs"
          title={`Traceable citation ${token}`}
        >
          {token}
        </span>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-on-surface">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={match.index} className="px-1 py-0.2 rounded bg-surface-container font-mono text-[11px] text-primary border border-outline-variant/30">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={match.index} className="italic text-on-surface-variant">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
