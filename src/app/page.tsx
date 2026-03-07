import { Header } from "@/components/sections/header";
import { HeroSection } from "@/components/sections/hero-section";
import { BentoGrid } from "@/components/sections/bento-grid";
import { RevenueDashboard } from "@/components/sections/revenue-dashboard";
import { TestAISection } from "@/components/sections/test-ai-section";
import { Footer } from "@/components/sections/footer";

export default function Home() {
  return (
    <div className="relative z-10">
      <Header />
      <main className="pt-16">
        <HeroSection />
        <BentoGrid />
        <RevenueDashboard />
        <TestAISection />
      </main>
      <Footer />
    </div>
  );
}
