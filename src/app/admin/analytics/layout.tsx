import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics Hub | Intent Admin",
  description: "Administrator analytics dashboard — business performance, revenue, traffic, and leads.",
  robots: "noindex, nofollow",
};

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
