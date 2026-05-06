import TopBar from "@/components/TopBar";

export default function StubPage({ title, userId, tier }: { title: string; userId: string; tier: string }) {
  return (
    <>
      <TopBar title={title} tier={tier} userId={userId} />
      <div className="px-6 py-16 text-center">
        <p className="font-mono lowercase text-xs text-text-faint">coming soon</p>
        <h2 className="font-sans text-2xl text-text-primary mt-2 lowercase">{title.replace(/_/g, " ")}</h2>
        <p className="text-text-muted text-sm mt-4 max-w-md mx-auto">
          this surface is still being built. for now, head back to{" "}
          <a href="/home" className="text-amber hover:underline">home</a>.
        </p>
      </div>
    </>
  );
}
