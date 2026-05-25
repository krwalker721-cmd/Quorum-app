import LogoMark from "@/components/LogoMark";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default function SuspendedPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: '#060504', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(232, 112, 42, 0.012) 3px, rgba(232, 112, 42, 0.012) 4px), linear-gradient(rgba(232, 112, 42, 0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(232, 112, 42, 0.016) 1px, transparent 1px)', backgroundSize: 'auto, 28px 28px, 28px 28px', backgroundAttachment: 'fixed' }}
    >
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <LogoMark size={36} />
        </div>
        <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-2">account_status</p>
        <h1 className="font-mono lowercase text-text-primary text-xl mb-4">
          your account has been suspended
        </h1>
        <p className="text-text-muted text-sm mb-8">
          you no longer have access to quorum. if you think this was a mistake, reach out to an
          admin.
        </p>
        <SignOutButton />
      </div>
    </main>
  );
}
