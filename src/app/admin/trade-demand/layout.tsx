import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trade Demand | Intent Admin Hub",
  description: "Prioritized Central Florida trade-demand evidence and sales workflow.",
  robots: "noindex, nofollow",
};

export default function TradeDemandLayout({ children }: { children: React.ReactNode }) {
  return children;
}
