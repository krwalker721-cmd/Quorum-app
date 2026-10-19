// What a new Buildathon starts with in the admin (owner, 2026-10-18): every
// event has the same title and is told apart by its number, and the rules,
// tagline and lobby welcome say in full what this is: a business idea taken
// to a working MVP, or proven with something real, built with founders you
// haven't built with yet. Everything stays editable per Buildathon; only the
// theme is meant to change each time.

/** Every Buildathon's title. Pages call each one "Buildathon #N". */
export const BUILDATHON_TITLE = "Buildathon";

/** "Buildathon #3". Code and addresses keep the old names (hackathon, Sprint). */
export function buildathonName(n: number | string) {
  return `${BUILDATHON_TITLE} #${n}`;
}

/**
 * Members never see the word "Sprint" any more, but the database's messages
 * (errors, pause and kickoff lines in the chat) were written with it. This
 * says them the new way at the edge, instead of rewriting every function.
 */
export function sayBuildathon(text: string) {
  return text.replace(/\bSprints\b/g, "Buildathons").replace(/\bSprint\b/g, "Buildathon").replace(/\bsprint\b/g, "Buildathon");
}

export const DEFAULT_TAGLINE = "48 hours to turn a business idea into something real, with founders you haven't built with yet.";

export const DEFAULT_LOBBY_WELCOME =
  "Welcome! Introduce yourself: who you are, what you're good at, and the kind of business you'd want to build. The best teams start here, before teams lock.";

export const DEFAULT_TEAM_SIZE = { min: 2, max: 4 };
export const DEFAULT_REVIEWS_PER_PERSON = 6;

export const DEFAULT_RULES = `### What to build
- **A business, not a side project.** A product or company idea that solves a real problem for people who would pay for it or use it.
- **Something real to show for it by the deadline:** a working MVP, *or* the idea backed by evidence: a clickable prototype, a landing page with sign-ups, conversations with customers, a pricing test.
- An idea you've been mulling is fine; a product you'd already built isn't. The work starts at kickoff, around the theme.

### Teams
- 2 to 4 founders. Bring a team, or join the pool and be matched when teams lock.
- The pool is the point: it's how you meet founders outside your cohort.
- Everyone on the team builds.

### Submitting
- Before the deadline: a name, a one-line tagline, the problem and who has it, and at least one thing people can try or see (a demo, a video or screenshots).
- A short PDF deck is optional.
- The form locks on the dot. Nothing after the deadline counts.

### Reviews and awards
- After the deadline, everyone who built reviews about six other projects. It takes about ten minutes.
- Your team can win only if at least one of you finishes your reviews.
- Four awards: Community pick, Most shipped, Most likely to become real, Crowd favourite.
- Every team gets its feedback after the reveal, without names.

### Working together
- Keep your idea in your team room until the reveal.
- Give the feedback you'd want to get.
- What you build belongs to your team. Agree together on what happens next.`;
