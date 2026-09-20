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

// The browser tab, and the headline Google shows on the search result — the
// same tag serves both. The name comes first and lowercase, the way the app
// writes it, so a narrow tab still reads "quorum"; the rest is there because a
// one-word result headline says nothing to someone who has never heard of it.
const TAB_TITLE = "quorum · a private network for founders";
// The headline a shared link shows in iMessage, Slack and X, where there is no
// surrounding context to say what Quorum is. Deliberately not the tab title.
const SOCIAL_TITLE = "Quorum · The honest version of LinkedIn";
const DESCRIPTION =
  "A private network of founders sharing real decisions, wins, and blockers, anchored by a cohort of twelve you meet every week.";

// metadataBase makes the preview image (app/opengraph-image.tsx) an absolute
// URL, which link previews in iMessage, Slack, and X require.
export const metadata: Metadata = {
  metadataBase: new URL(LEGAL.site),
  title: { default: TAB_TITLE, template: "%s · quorum" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Quorum",
    url: "/",
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SOCIAL_TITLE, description: DESCRIPTION },
  // Icons are declared here, against files in public/, rather than through the
  // app/icon.* convention. Two reasons, both about the favicon Google shows
  // beside a search result: the convention serves a build-hashed URL
  // (/icon.svg?icon.1-abc.svg) and Google asks that the favicon URL be stable,
  // and it served SVG alone, which Google's favicon crawler does not accept —
  // it takes BMP, GIF, ICO, PNG, JPEG, PPM and TIFF. Hence a real 16/32/48 ICO
  // and PNGs; the SVG stays first for browsers, which render it crisply.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// Tells Google which entity this site is, so the brand can be matched to
// searches for the name rather than to the several other Quorums. Only facts
// that are already public on the site.
const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Quorum",
  alternateName: ["Quorum HQ", "quorumhq"],
  url: LEGAL.site,
  logo: `${LEGAL.site}/icon-512.png`,
  description: DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${spaceGrotesk.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
