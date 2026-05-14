// Tiny markdown renderer. Handles: # / ## / ### headings, blank-line paragraphs,
// - bullet lists, **bold**, *italic*, `inline code`. No HTML escaping beyond
// what React does automatically.

import React from "react";

function inline(text: string, keyBase: string): React.ReactNode[] {
  // Process bold, italic, inline code in one pass.
  const tokens: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
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

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let k = 0;

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
    blocks.push(
      <ul
        key={`ul-${k++}`}
        className="list-disc pl-6 mb-4 space-y-1 text-text-secondary"
      >
        {list.map((item, idx) => (
          <li key={idx}>{inline(item, `li${k}-${idx}`)}</li>
        ))}
      </ul>,
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
    if (h1) {
      flushPara();
      flushList();
      blocks.push(
        <h1
          key={`h1-${k++}`}
          className="font-sans lowercase text-text-primary text-2xl mt-2 mb-4"
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
          className="font-sans lowercase text-text-primary text-lg mt-6 mb-3"
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
          className="font-mono lowercase tracking-wider text-text-muted text-xs mt-5 mb-2"
        >
          {h3[1]}
        </h3>,
      );
    } else if (li) {
      flushPara();
      list.push(li[1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div>{blocks}</div>;
}
