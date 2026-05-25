import LogoMark from "@/components/LogoMark";

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: '#060504', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(232, 112, 42, 0.018) 3px, rgba(232, 112, 42, 0.018) 4px), linear-gradient(rgba(232, 112, 42, 0.065) 1px, transparent 1px), linear-gradient(90deg, rgba(232, 112, 42, 0.065) 1px, transparent 1px)', backgroundSize: 'auto, 28px 28px, 28px 28px', backgroundAttachment: 'fixed' }}
    >
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <LogoMark size={36} />
        </div>
        <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-2">
          platform_status
        </p>
        <h1 className="font-mono lowercase text-text-primary text-xl">
          quorum is undergoing maintenance â€” back soon
        </h1>
      </div>
    </main>
  );
}
