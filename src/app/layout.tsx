import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { OrganizationJsonLd } from "@/components/seo/json-ld";
import {
  SITE_URL,
  SITE_NAME,
  SEO_TITLE_DEFAULT,
  DEFAULT_DESCRIPTION,
} from "@/lib/seo";

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
    default: SEO_TITLE_DEFAULT,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "contractor lead generation",
    "lead generation for contractors",
    "contractor marketing",
    "lead generation Florida",
    "HVAC lead generation",
    "plumbing lead generation",
    "engineer revenue",
    "revenue generation",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SEO_TITLE_DEFAULT,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Intent — contractor lead generation for the trades",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE_DEFAULT,
    description: DEFAULT_DESCRIPTION,
    images: ["/opengraph-image"],
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
      <head>
        <link rel="canonical" href={SITE_URL} />
      </head>
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
