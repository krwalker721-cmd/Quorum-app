function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-1 pr-8 min-w-0">
      <span className="font-mono lowercase text-[0.6rem] tracking-wider text-text-faint">
        {label}
      </span>
      <span className="font-mono text-sm text-text-primary">{value}</span>
    </div>
  );
}

export default function VaultStatStrip({
  savedByCommunity,
  notesWritten,
  wisdomPreserved,
}: {
  savedByCommunity: number;
  notesWritten: number;
  wisdomPreserved: number;
}) {
  return (
    <div
      className="flex items-center px-4 py-3 border overflow-x-auto scroll-thin"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <Stat label="saved_by_community" value={savedByCommunity} />
      <Stat label="notes_written" value={notesWritten} />
      <Stat label="wisdom_preserved" value={wisdomPreserved} />
    </div>
  );
}
