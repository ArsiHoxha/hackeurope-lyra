import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { FeatureGrid } from "@/components/FeatureGrid";
import { DemoCallout } from "@/components/DemoCallout";
import { TestimonialSection } from "@/components/TestimonialCard";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <HeroSection />
        <FeatureGrid />
        <DemoCallout />
        <TestimonialSection />
      </main>
      <Footer />
    </div>
  );
}
