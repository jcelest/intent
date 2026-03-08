import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { OrganizationJsonLd } from "@/components/seo/json-ld";
import { SITE_URL, SITE_NAME, SITE_TAGLINE, DEFAULT_DESCRIPTION } from "@/lib/seo";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE} — AI Marketing for Contractors & Florida`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "AI marketing agency Florida",
    "lead generation Florida",
    "AI marketing for contractors",
    "contractor lead generation",
    "AI voice qualification",
    "revenue automation Florida",
    "Central Florida marketing agency",
    "Orlando AI marketing",
    "Florida business growth",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_TAGLINE} — AI Marketing for Contractors & Florida`,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-display antialiased bg-oled text-foreground`}
      >
        {/* Critical CSS fallback - ensures dark mode shows even if main stylesheet fails to load */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--background:#000;--foreground:#f8fafc;--card:#020617;--accent:#22d3ee;--muted:#64748b;--border:#1e293b}html,body{background:var(--background)!important;color:var(--foreground)!important;margin:0;min-height:100vh}`,
          }}
        />
        <div className="cyan-bg-animation" aria-hidden />
        <div className="cyan-bg-grid" aria-hidden />
        <div className="noise-bg" aria-hidden />
        <OrganizationJsonLd />
        <div className="relative z-[10000] min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
