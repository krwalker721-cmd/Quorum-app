import type { PublicProject } from "./showcase";

// Peer reviews (036): what both the server and the review round need. No
// server imports here.

/** One of the viewer's reviews, with the project to look at. */
export type MyReview = {
  id: string;
  position: number;
  score_problem: number | null;
  score_works: number | null;
  score_use: number | null;
  strength: string | null;
  suggestion: string | null;
  is_favourite: boolean;
  completed_at: string | null;
  project: PublicProject | null;
};

export const REVIEW_COLUMNS = "id, position, submission_id, score_problem, score_works, score_use, strength, suggestion, is_favourite, completed_at";

/** The three ratings, in the order the review round asks them. */
export const REVIEW_QUESTIONS: { key: "score_problem" | "score_works" | "score_use"; label: string; q: string; low: string; high: string }[] = [
  { key: "score_problem", label: "Problem", q: "Is the problem worth solving?", low: "Not really", high: "Absolutely" },
  { key: "score_works", label: "Works", q: "How much of it works?", low: "Mostly an idea", high: "A working product" },
  { key: "score_use", label: "Use", q: "Would you use it?", low: "No", high: "I'd use it today" },
];
