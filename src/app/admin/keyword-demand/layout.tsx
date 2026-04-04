import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Keyword demand (preview) | Intent Admin",
  description: "Keyword demand intelligence mockup for Google Ads API integration.",
  robots: "noindex, nofollow",
};

export default function KeywordDemandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
