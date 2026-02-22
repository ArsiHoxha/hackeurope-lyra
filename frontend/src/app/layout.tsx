import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Attestify — Dashboard",
  description:
    "Cryptographic AI watermarking system demo dashboard. Verify, analyze, and protect AI-generated content.",
  keywords: [
    "AI watermarking",
    "forensic attribution",
    "model protection",
    "cryptographic verification",
    "IP protection",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark" suppressHydrationWarning>
        <body className={`${inter.variable} font-sans antialiased`}>
          <TooltipProvider delayDuration={200}>
            {children}
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
