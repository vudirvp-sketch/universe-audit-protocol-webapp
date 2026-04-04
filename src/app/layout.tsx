import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Universe Audit Protocol v10.0 - Narrative Analysis Tool",
  description: "A comprehensive tool for auditing fictional worlds and narratives through 4 hierarchical levels: Mechanism, Body, Psyche, and Meta. Based on the Russian protocol АУДИТ_ВСЕЛЕННОЙ_v10.0.",
  keywords: ["narrative audit", "worldbuilding", "fiction analysis", "story structure", "grief architecture", "character analysis"],
  authors: [{ name: "Universe Audit Protocol Team" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌌</text></svg>",
  },
  openGraph: {
    title: "Universe Audit Protocol v10.0",
    description: "Audit your fictional worlds through 4 hierarchical levels with 52 checklist items",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
