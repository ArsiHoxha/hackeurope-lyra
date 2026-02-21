"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const testimonials = [
  {
    name: "Dr. Sarah Chen",
    role: "Head of AI Security, TechGuard",
    initials: "SC",
    quote:
      "CryptoAI Watermark has been instrumental in protecting our proprietary models. The forensic verification is unmatched.",
    rating: 5,
  },
  {
    name: "Marcus Williams",
    role: "CTO, DataShield Labs",
    initials: "MW",
    quote:
      "We detected three unauthorized model distillations in the first month. The ROI was immediate and significant.",
    rating: 5,
  },
  {
    name: "Elena Rodriguez",
    role: "VP Engineering, NeuralSafe",
    initials: "ER",
    quote:
      "The integration was seamless — two lines of code and our entire pipeline was watermark-protected. Incredible technology.",
    rating: 5,
  },
];

export function TestimonialSection() {
  return (
    <section id="testimonials" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Trusted by Security Leaders
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            See what industry experts say about our watermarking technology.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full transition-shadow duration-300 hover:shadow-lg">
                <CardContent className="pt-6">
                  {/* Stars */}
                  <div className="mb-4 flex gap-1">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="size-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>

                  {/* Author */}
                  <div className="mt-6 flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-muted text-sm font-medium text-foreground">
                        {testimonial.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">
                        {testimonial.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
