import { LeadNetSocialComparison } from "@/components/sections/leadnet-social-comparison";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeadNet Social Comparison",
  robots: { index: false, follow: false },
};

/** 9:16 export canvas — screenshot or use scripts/export-leadnet-social.mjs */
export default function LeadNetSocialPage() {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center p-0">
      <LeadNetSocialComparison />
    </main>
  );
}
