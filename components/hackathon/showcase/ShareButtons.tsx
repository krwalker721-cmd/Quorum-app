"use client";

import { useState } from "react";
import ui from "@/components/ui/sleek.module.css";

/**
 * Copy link, X and LinkedIn, for a public showcase page. The URL is always
 * the canonical one (quorumhq.co), whatever host is serving the page.
 */
export default function ShareButtons({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const x = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={ui.softBtn}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            // Older browsers: select-and-copy from a prompt.
            window.prompt("Copy this link", url);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Link copied ✓" : "Copy link"}
      </button>
      <a href={x} target="_blank" rel="noopener noreferrer" className={ui.ghostBtn} style={{ textDecoration: "none" }}>
        Share on X
      </a>
      <a href={linkedin} target="_blank" rel="noopener noreferrer" className={ui.ghostBtn} style={{ textDecoration: "none" }}>
        Share on LinkedIn
      </a>
    </div>
  );
}
