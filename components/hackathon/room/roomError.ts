import { sayBuildathon } from "@/lib/hackathons/defaults";

// The database's refusals, in words. RLS refusals carry no message of their
// own, and in the room they all mean the same thing.
export function roomError(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return "Something went wrong. Try again.";
  if (e.code === "42501" || /row-level security/i.test(e.message ?? "")) {
    return "The room is read-only now, so that wasn't saved.";
  }
  if (e.code === "23514") return "That's too long, or missing something it needs.";
  return e.message ? sayBuildathon(e.message) : "Something went wrong. Try again.";
}
