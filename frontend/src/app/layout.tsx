import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CryptoAI Watermark — Invisible, Forensically Verifiable AI Watermarks",
  description:
    "Protect your AI models against IP theft, output scraping, and synthetic data contamination with cryptographically verifiable watermarks.",
  keywords: [
    "AI watermarking",
    "forensic attribution",
    "model protection",
    "cryptographic verification",
    "IP protection",
    "synthetic data safety",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
