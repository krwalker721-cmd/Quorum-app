import LogoMark from "@/components/LogoMark";

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: '#0d1117', backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundAttachment: 'fixed' }}
    >
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <LogoMark size={36} />
        </div>
        <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-2">
          platform_status
        </p>
        <h1 className="font-mono lowercase text-text-primary text-xl">
          quorum is undergoing maintenance — back soon
        </h1>
      </div>
    </main>
  );
}
