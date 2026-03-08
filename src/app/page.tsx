import { Header } from "@/components/sections/header";
import { HeroSection } from "@/components/sections/hero-section";
import { BentoGrid } from "@/components/sections/bento-grid";
import { RevenueDashboard } from "@/components/sections/revenue-dashboard";
import { InquiryFormSection } from "@/components/sections/inquiry-form-section";
import { Footer } from "@/components/sections/footer";

export default function Home() {
  return (
    <div className="relative z-10">
      <Header />
      <main className="pt-16">
        <HeroSection />
        <BentoGrid />
        <RevenueDashboard />
        <InquiryFormSection />
      </main>
      <Footer />
    </div>
  );
}
