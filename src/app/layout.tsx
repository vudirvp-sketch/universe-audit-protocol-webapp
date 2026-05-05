import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Протокол Аудита Вселенной v11.0",
  description: "Анализ вымышленных миров через 4 иерархических уровня: Механизм, Тело, Психика и Мета. На основе протокола АУДИТ_ВСЕЛЕННОЙ_v11.0.",
  keywords: ["аудит вселенной", "ворлдбилдинг", "анализ нарратива", "структура истории", "архитектура горя", "анализ персонажей"],
  authors: [{ name: "Протокол Аудита Вселенной" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌌</text></svg>",
  },
  openGraph: {
    title: "Протокол Аудита Вселенной v11.0",
    description: "Анализ вымышленных миров через 4 иерархических уровня с 52 критериями чеклиста",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
