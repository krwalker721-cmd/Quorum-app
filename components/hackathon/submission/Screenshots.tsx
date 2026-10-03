"use client";

import { useRef, useState } from "react";
import ui from "@/components/ui/sleek.module.css";
import { sprintDb } from "@/lib/hackathons/actions";
import { LABEL_RESET, LIMITS, SUBMISSION_BUCKET, prepareScreenshot, screenshotPath } from "@/lib/hackathons/submission";

// Up to six screenshots: shrunk in the browser, uploaded to the team's own
// folder in the private bucket (the storage policies only let the team write
// there, and only while the Sprint is live), shown here through URLs that
// expire. Drag to reorder, or use the arrows; the first one leads the
// showcase. Removing one deletes its file.
export default function Screenshots({
  hackathonId,
  teamId,
  paths,
  urls,
  disabled,
  onChange,
  onUploaded,
}: {
  hackathonId: string;
  teamId: string;
  paths: string[];
  urls: Record<string, string>;
  disabled: boolean;
  onChange: (paths: string[]) => void;
  onUploaded: (path: string, url: string) => void;
}) {
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(paths);
  latest.current = paths;
  const room = LIMITS.screenshots - paths.length;

  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const picked = Array.from(files).slice(0, Math.max(0, LIMITS.screenshots - latest.current.length));
    if (files.length > picked.length) setError(`Up to ${LIMITS.screenshots} screenshots; the extra ones were left out.`);
    for (const file of picked) {
      setBusy((n) => n + 1);
      try {
        const { blob, ext, type } = await prepareScreenshot(file);
        const path = screenshotPath(hackathonId, teamId, ext);
        const { error: e } = await sprintDb()
          .storage.from(SUBMISSION_BUCKET)
          .upload(path, blob, { contentType: type, cacheControl: "3600", upsert: false });
        if (e) throw new Error(/row-level security|unauthorized|403/i.test(e.message) ? "Uploads are closed now." : e.message);
        onUploaded(path, URL.createObjectURL(blob));
        latest.current = [...latest.current, path];
        onChange(latest.current);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That upload didn't work.");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  function remove(path: string) {
    onChange(paths.filter((p) => p !== path));
    // The file goes too (the team may delete its own files while live).
    void sprintDb().storage.from(SUBMISSION_BUCKET).remove([path]);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= paths.length || from === to) return;
    const next = paths.slice();
    const [p] = next.splice(from, 1);
    next.splice(to, 0, p);
    onChange(next);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Screenshots</span>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {paths.length} / {LIMITS.screenshots} · the first leads the showcase
        </span>
      </div>

      {paths.length > 0 && (
        <ol className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {paths.map((p, i) => (
            <li
              key={p}
              draggable={!disabled}
              onDragStart={() => setDragging(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging !== null) move(dragging, i);
                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
              style={{
                border: `1px solid ${dragging === i ? "rgba(245, 158, 11, 0.5)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 10,
                overflow: "hidden",
                background: "rgba(255,255,255,0.02)",
                cursor: disabled ? "default" : "grab",
              }}
            >
              {urls[p] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[p]} alt={`Screenshot ${i + 1}`} style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ aspectRatio: "16 / 10", display: "grid", placeItems: "center", fontSize: 11.5, color: "var(--text-muted)" }}>Loading…</div>
              )}
              {!disabled && (
                <div className="flex items-center justify-between" style={{ padding: "4px 6px" }}>
                  <span className="flex gap-1">
                    <button type="button" className={ui.textBtn} style={{ fontSize: 12, padding: "2px 6px" }} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move screenshot ${i + 1} earlier`}>
                      ←
                    </button>
                    <button type="button" className={ui.textBtn} style={{ fontSize: 12, padding: "2px 6px" }} disabled={i === paths.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move screenshot ${i + 1} later`}>
                      →
                    </button>
                  </span>
                  <button type="button" className={`${ui.textBtn} hover:!text-red-400`} style={{ fontSize: 12 }} onClick={() => remove(p)} aria-label={`Remove screenshot ${i + 1}`}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {!disabled && room > 0 && (
        <div style={{ marginTop: paths.length ? 12 : 0 }}>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            id="screenshot-input"
            onChange={(e) => void add(e.target.files)}
          />
          <label
            htmlFor="screenshot-input"
            className={`${ui.ghostBtn} w-full`}
            style={{ ...LABEL_RESET, fontSize: 13, display: "block", textAlign: "center", cursor: "pointer" }}
          >
            {busy > 0 ? "Uploading…" : paths.length ? "Add more screenshots" : "Add screenshots"}
          </label>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
            PNG, JPEG, WebP or GIF. Big pictures are shrunk before they upload.
          </p>
        </div>
      )}
      {error && <p style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
