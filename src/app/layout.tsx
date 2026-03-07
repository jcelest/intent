import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
  title: "Intent | We Engineer Revenue",
  description:
    "Moving beyond traditional marketing. We build proprietary AI infrastructure that captures, qualifies, and closes your business leads automatically.",
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
        <div className="relative z-[10000] min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
