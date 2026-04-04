import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intent Traffic | Intent Admin Hub",
  description: "Florida-focused search volume and keyword ideas from the Google Ads API.",
  robots: "noindex, nofollow",
};

export default function KeywordDemandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
