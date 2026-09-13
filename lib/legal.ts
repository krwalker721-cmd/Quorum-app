// Who Quorum legally is, in one place. Every legal page and footer link reads
// from here, so a change — a support inbox on the domain, a future LLC — is one
// edit rather than a hunt through three documents.
//
// Decided 2026-09-12 (LAUNCH.md, Phase 0). The contact address is a stopgap
// until support@quorumhq.co exists (LAUNCH.md, Phase 1: inbound email).

export const LEGAL = {
  /** The legal person behind Quorum — a sole proprietorship. */
  owner: "Denyse Walker",
  /** The trade name the business operates under. */
  tradeName: "Quorum",
  /** How the contracting party is named in the documents. */
  party: "Denyse Walker, doing business as Quorum",
  state: "Massachusetts",
  contactEmail: "krwalker721@gmail.com",
  site: "https://quorumhq.co",
  /** Bump whenever the substance of any legal page changes. */
  effectiveDate: "September 13, 2026",
} as const;
