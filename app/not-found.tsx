import Link from "next/link";
import StatusPage, { STATUS_PRIMARY, STATUS_PRIMARY_STYLE, STATUS_SECONDARY } from "@/components/StatusPage";

export const metadata = { title: "Page not found" };

// "/" sends each visitor to the right place: the landing page when signed
// out, the app when signed in.
export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="This page isn't here."
      body="The link may be old, or the page may have moved."
      actions={
        <>
          <Link href="/" className={STATUS_PRIMARY} style={STATUS_PRIMARY_STYLE}>
            Go home
          </Link>
          <Link href="/pricing" className={STATUS_SECONDARY}>
            See pricing
          </Link>
        </>
      }
    />
  );
}
