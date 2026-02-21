"use client";

import { motion } from "framer-motion";
import {
  Fingerprint,
  Search,
  ShieldAlert,
  DatabaseZap,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const features = [
  {
    icon: Fingerprint,
    title: "Fingerprint Embedding",
    description:
      "Invisible, statistically verifiable fingerprints embedded directly into model outputs without degrading quality.",
  },
  {
    icon: Search,
    title: "Forensic Verification",
    description:
      "Prove ownership of generated outputs with cryptographic certainty. Court-admissible forensic reports.",
  },
  {
    icon: ShieldAlert,
    title: "IP & Data Protection",
    description:
      "Prevent model distillation, output scraping, and unauthorized commercial use of your AI models.",
  },
  {
    icon: DatabaseZap,
    title: "Synthetic Data Safety",
    description:
      "Guard against contaminated training data by detecting AI-generated content in your datasets.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export function FeatureGrid() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Enterprise-Grade AI Protection
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-lg text-muted-foreground"
          >
            Comprehensive watermarking and verification tools to safeguard your
            AI intellectual property.
          </motion.p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={itemVariants}>
              <Card className="group relative h-full overflow-hidden transition-shadow duration-300 hover:shadow-lg">
                {/* Top accent */}
                <div
                  className="absolute inset-x-0 top-0 h-px bg-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                <CardHeader>
                  <div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-muted transition-transform duration-300 group-hover:scale-110">
                    <feature.icon className="size-6 text-foreground" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="mt-2 text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
