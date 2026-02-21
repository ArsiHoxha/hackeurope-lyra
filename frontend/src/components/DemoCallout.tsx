"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FileText, ShieldCheck, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: "01",
    icon: FileText,
    title: "Paste Content",
    description: "Paste your generated text, code, or upload media files.",
  },
  {
    number: "02",
    icon: ShieldCheck,
    title: "Verify Watermark",
    description: "Our engine scans for embedded cryptographic fingerprints.",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Get Report",
    description: "Receive an instant forensic report with confidence scores.",
  },
];

export function DemoCallout() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 sm:p-12 lg:p-16">
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                How It Works
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Verify AI-generated content in three simple steps.
              </p>
            </motion.div>

            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {steps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="relative text-center"
                >
                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div className="absolute right-0 top-8 hidden h-px w-full translate-x-1/2 bg-border sm:block" />
                  )}

                  <div className="relative mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
                    <step.icon className="size-7 text-foreground" />
                    <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-12 text-center"
            >
              <Link href="/demo">
                <Button size="lg" className="gap-2 text-base">
                  Try Demo Now
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
