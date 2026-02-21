"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FaultyTerminal from "@/components/FaultyTerminal";
import LetterGlitch from "./LetterGlitch";
export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] overflow-hidden">
      {/* FaultyTerminal as full background */}
      <div className="absolute inset-0 z-0">
         
<LetterGlitch
  glitchSpeed={50}
  centerVignette={true}
  outerVignette={false}
  smooth={true}
/>

      </div>

      {/* Dark overlay for text readability */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-black/60" />

      {/* Content */}
      <div className="pointer-events-none relative z-[2] mx-auto flex min-h-[90vh] max-w-4xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="secondary" className="pointer-events-auto mb-6 gap-1.5 border border-white/20 bg-white/10 px-3 py-1 text-sm text-white">
            <ShieldCheck className="size-3.5" />
            Cryptographic AI Protection
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          Invisible, Forensically Verifiable{" "}
          <span className="text-white/70 underline decoration-white/20 underline-offset-4">AI Watermarks</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl"
        >
          Protect your AI models against IP theft, output scraping, and
          synthetic data contamination with cryptographically verifiable
          watermarks.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="pointer-events-auto mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link href="/dashboard">
            <Button size="lg" className="gap-2 rounded-xl text-base shadow-lg">
              Open Dashboard
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/#features">
            <Button variant="outline" size="lg" className="rounded-xl border-white/40 bg-transparent text-base text-white hover:border-white/60 hover:bg-white/10 hover:text-white">
              Learn More
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
