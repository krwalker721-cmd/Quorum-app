// A team's submission (Phase 8, migrations 020 and 030): its fields, what it
// takes to count as submitted, video embeds, and screenshot shrinking. Used
// by the form, the showcase, and the server page. No server imports here.

export const SUBMISSION_BUCKET = "hackathon-submissions";

/** Undoes globals.css's terminal-style `label` (mono, lower case) for the sleek form. */
export const LABEL_RESET = {
  fontFamily: "inherit",
  fontSize: "inherit",
  letterSpacing: "normal",
  textTransform: "none",
  color: "inherit",
} as const;

export const SUBMISSION_COLUMNS =
  "id, team_id, hackathon_id, project_name, tagline, problem, description, demo_url, repo_url, video_url, " +
  "screenshots, built_with, submitted_by, submitted_at, updated_at, is_complete, completed_at, last_edited_by";

export type SubmissionRow = {
  id: string;
  team_id: string;
  hackathon_id: string;
  project_name: string | null;
  tagline: string | null;
  problem: string | null;
  description: string | null;
  demo_url: string | null;
  repo_url: string | null;
  video_url: string | null;
  screenshots: string[];
  built_with: string[];
  submitted_by: string | null;
  submitted_at: string;
  updated_at: string;
  is_complete: boolean;
  completed_at: string | null;
  last_edited_by: string | null;
};

/** The fields a team edits. */
export type SubmissionFields = {
  project_name: string;
  tagline: string;
  problem: string;
  description: string;
  demo_url: string;
  repo_url: string;
  video_url: string;
  screenshots: string[];
  built_with: string[];
};
export type FieldKey = keyof SubmissionFields;

export const TEXT_KEYS = ["project_name", "tagline", "problem", "description", "demo_url", "repo_url", "video_url"] as const;

/** The database's limits (migration 020). */
export const LIMITS = {
  project_name: 80,
  tagline: 140,
  problem: 5000,
  description: 20000,
  url: 2000,
  screenshots: 6,
  built_with: 20,
  tag: 40,
  fileBytes: 5 * 1024 * 1024,
} as const;

export const EMPTY_FIELDS: SubmissionFields = {
  project_name: "",
  tagline: "",
  problem: "",
  description: "",
  demo_url: "",
  repo_url: "",
  video_url: "",
  screenshots: [],
  built_with: [],
};

export function fieldsOf(row: SubmissionRow | null): SubmissionFields {
  if (!row) return { ...EMPTY_FIELDS };
  return {
    project_name: row.project_name ?? "",
    tagline: row.tagline ?? "",
    problem: row.problem ?? "",
    description: row.description ?? "",
    demo_url: row.demo_url ?? "",
    repo_url: row.repo_url ?? "",
    video_url: row.video_url ?? "",
    screenshots: row.screenshots ?? [],
    built_with: row.built_with ?? [],
  };
}

export const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

/**
 * What's still missing for it to count as submitted. Mirrors is_complete in
 * the database (030), which has the final word.
 */
export function missing(f: SubmissionFields): { key: string; label: string; done: boolean }[] {
  const has = (v: string) => v.trim() !== "";
  return [
    { key: "project_name", label: "Project name", done: has(f.project_name) },
    { key: "tagline", label: "One-line tagline", done: has(f.tagline) },
    { key: "problem", label: "The problem it solves", done: has(f.problem) },
    {
      key: "evidence",
      label: "A demo link, a video, or a screenshot",
      done: (has(f.demo_url) && isUrl(f.demo_url)) || (has(f.video_url) && isUrl(f.video_url)) || f.screenshots.length > 0,
    },
  ];
}

/** An embeddable player for YouTube, Loom and Vimeo links; null for anything else. */
export function videoEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const id = (s: string | null | undefined) => (s && /^[A-Za-z0-9_-]{6,64}$/.test(s) ? s : null);
  if (host === "youtu.be") {
    const v = id(u.pathname.slice(1));
    return v ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const v = id(u.searchParams.get("v")) ?? id(u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]);
    return v ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === "loom.com") {
    const v = id(u.pathname.match(/^\/(?:share|embed)\/([^/?]+)/)?.[1]);
    return v ? `https://www.loom.com/embed/${v}` : null;
  }
  if (host === "vimeo.com") {
    const v = u.pathname.match(/^\/(\d{4,12})/)?.[1];
    return v ? `https://player.vimeo.com/video/${v}` : null;
  }
  return null;
}

/** Where a team's screenshot lives in the bucket: {hackathon}/{team}/{file}. */
export function screenshotPath(hackathonId: string, teamId: string, ext: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${hackathonId}/${teamId}/${Date.now()}-${rand}.${ext}`;
}

/**
 * Shrinks a picture in the browser before it's uploaded: at most 1920 px on
 * the long side, WebP (JPEG where the browser can't make WebP), under the
 * bucket's 5 MB. GIFs are kept as they are (they may be animated) if they
 * already fit. No library: a canvas does it.
 */
export async function prepareScreenshot(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
    throw new Error("Screenshots can be PNG, JPEG, WebP or GIF.");
  }
  if (file.type === "image/gif") {
    if (file.size > LIMITS.fileBytes) throw new Error("That GIF is over 5 MB. Try a shorter one, or a still image.");
    return { blob: file, ext: "gif", type: "image/gif" };
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const encode = async (maxSide: number, quality: number) => {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const as = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
    const webp = await as("image/webp");
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", type: "image/webp" };
    const jpeg = await as("image/jpeg");
    if (!jpeg) throw new Error("This browser couldn't process that picture.");
    return { blob: jpeg, ext: "jpg", type: "image/jpeg" };
  };

  try {
    for (const [side, q] of [
      [1920, 0.85],
      [1600, 0.75],
      [1280, 0.65],
    ] as const) {
      const out = await encode(side, q);
      if (out.blob.size <= LIMITS.fileBytes) return out;
    }
  } finally {
    bitmap.close();
  }
  throw new Error("That picture is too large even after shrinking it.");
}
