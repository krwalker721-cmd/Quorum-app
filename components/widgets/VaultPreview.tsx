const TEASERS = [
  {
    title: "the cap-table mistake i made at $1.2m arr",
    author: "kira oduya",
    credential: "founder · pre-seed",
  },
  {
    title: "what 90 cold outbound emails actually got me",
    author: "marcus hale",
    credential: "founder · seed",
  },
];

export default function VaultPreview() {
  return (
    <div
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
        vault_preview
      </p>
      <div className="space-y-3">
        {TEASERS.map((t, i) => (
          <div
            key={i}
            className="pb-3"
            style={{
              borderBottom: i < TEASERS.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <p className="text-text-secondary text-[0.85rem] leading-snug">{t.title}</p>
            <div className="flex items-center justify-between mt-1.5">
              <p className="font-mono lowercase text-[0.65rem] text-text-faint">
                {t.author.toLowerCase()} · {t.credential}
              </p>
              <span className="font-mono lowercase text-[0.6rem] text-amber">vault_by</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
