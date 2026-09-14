import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LEGAL } from "@/lib/legal";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const TITLE = "Quorum · The honest version of LinkedIn";
const DESCRIPTION =
  "A private network of founders sharing real decisions, wins, and blockers, anchored by a cohort of twelve you meet every week.";

// metadataBase makes the preview image (app/opengraph-image.tsx) an absolute
// URL, which link previews in iMessage, Slack, and X require.
export const metadata: Metadata = {
  metadataBase: new URL(LEGAL.site),
  title: { default: TITLE, template: "%s · Quorum" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Quorum",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${spaceGrotesk.variable}`}>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
