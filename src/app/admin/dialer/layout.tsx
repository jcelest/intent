import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intent Dialer",
  description: "Intent's private sales power dialer.",
  robots: "noindex, nofollow",
};

export default function DialerLayout({ children }: { children: React.ReactNode }) {
  return children;
}

