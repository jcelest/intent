import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Keyword demand | Intent Admin",
  description: "Keyword demand and search volume from the Google Ads API (Keyword Planner).",
  robots: "noindex, nofollow",
};

export default function KeywordDemandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
