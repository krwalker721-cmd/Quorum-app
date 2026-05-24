import LogoMark from "@/components/LogoMark";

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: '#060504', backgroundImage: 'radial-gradient(ellipse at 0% 0%, rgba(220,100,20,0.28) 0%, rgba(220,100,20,0.08) 35%, transparent 65%), radial-gradient(ellipse at 100% 100%, rgba(220,100,20,0.04) 0%, transparent 40%), linear-gradient(rgba(220,100,20,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(220,100,20,0.028) 1px, transparent 1px)', backgroundSize: 'auto, auto, 28px 28px, 28px 28px', backgroundAttachment: 'fixed' }}
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
