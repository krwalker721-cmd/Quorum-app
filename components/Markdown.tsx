// Tiny markdown renderer. Handles: # / ## / ### headings, blank-line paragraphs,
// - bullet lists, 1. numbered lists, **bold**, *italic*, `inline code`, and
// [links](https://…) (http and https only). No HTML is ever rendered from the
// source: React escapes all of it.

import React from "react";

function inline(text: string, keyBase: string): React.ReactNode[] {
  // Process bold, italic, inline code in one pass.
  const tokens: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    const tok = m[0];
    const link = tok.startsWith("[") ? tok.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/) : null;
    if (link) {
      tokens.push(
        <a
          key={`${keyBase}-a-${i++}`}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline underline-offset-2 hover:text-text-primary"
        >
          {link[1]}
        </a>,
      );
    } else if (tok.startsWith("**")) {
      tokens.push(
        <strong key={`${keyBase}-b-${i++}`} className="text-text-primary">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("`")) {
      tokens.push(
        <code
          key={`${keyBase}-c-${i++}`}
          className="font-mono text-[0.85em] px-1"
          style={{ background: "var(--card)", color: "#f59e0b" }}
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      tokens.push(
        <em key={`${keyBase}-i-${i++}`} className="italic">
          {tok.slice(1, -1)}
        </em>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}

export default function Markdown({
  source,
  plainHeadings = false,
}: {
  source: string;
  /** Headings in sentence case, not the older lower-case style (a project's description). */
  plainHeadings?: boolean;
}) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let ordered = false;
  let k = 0;
  const caseClass = plainHeadings ? "" : " lowercase";

  const flushPara = () => {
    if (para.length === 0) return;
    const txt = para.join(" ");
    blocks.push(
      <p
        key={`p-${k++}`}
        className="text-text-secondary leading-relaxed mb-4 whitespace-pre-line"
      >
        {inline(txt, `p${k}`)}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    const items = list.map((item, idx) => <li key={idx}>{inline(item, `li${k}-${idx}`)}</li>);
    blocks.push(
      ordered ? (
        <ol key={`ol-${k++}`} className="list-decimal pl-6 mb-4 space-y-1 text-text-secondary">
          {items}
        </ol>
      ) : (
        <ul
          key={`ul-${k++}`}
          className="list-disc pl-6 mb-4 space-y-1 text-text-secondary"
        >
          {items}
        </ul>
      ),
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    const oli = line.match(/^\d{1,3}[.)]\s+(.*)$/);
    if (h1) {
      flushPara();
      flushList();
      blocks.push(
        <h1
          key={`h1-${k++}`}
          className={`font-sans${caseClass} text-text-primary text-2xl mt-2 mb-4`}
        >
          {h1[1]}
        </h1>,
      );
    } else if (h2) {
      flushPara();
      flushList();
      blocks.push(
        <h2
          key={`h2-${k++}`}
          className={`font-sans${caseClass} text-text-primary text-lg mt-6 mb-3`}
        >
          {h2[1]}
        </h2>,
      );
    } else if (h3) {
      flushPara();
      flushList();
      blocks.push(
        <h3
          key={`h3-${k++}`}
          className={plainHeadings ? "text-text-primary text-base font-semibold mt-5 mb-2" : "font-mono lowercase tracking-wider text-text-muted text-xs mt-5 mb-2"}
        >
          {h3[1]}
        </h3>,
      );
    } else if (li || oli) {
      flushPara();
      // A bullet list and a numbered list are separate lists.
      if (list.length > 0 && ordered !== Boolean(oli)) flushList();
      ordered = Boolean(oli);
      list.push((li ?? oli)![1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div>{blocks}</div>;
}
