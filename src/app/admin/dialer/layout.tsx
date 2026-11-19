import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Intent Dialer",
  description: "Intent's private sales power dialer.",
  robots: "noindex, nofollow",
  appleWebApp: {
    capable: true,
    title: "Intent Dialer",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1266c4",
};

export default function DialerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
