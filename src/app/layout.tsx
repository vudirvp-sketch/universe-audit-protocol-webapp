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
  title: "Протокол Аудита Вселенной v16",
  description: "Качественный аудит вымышленных миров: 5 блоков, 5 связанных измерений, корневые проблемы и приоритетные рекомендации, вердикт в качественных полосах. Free-form markdown, streaming.",
  keywords: ["аудит вселенной", "ворлдбилдинг", "анализ нарратива", "структура истории", "аудит мира", "каузальный аудит", "мир как система"],
  authors: [{ name: "Протокол Аудита Вселенной" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌌</text></svg>",
  },
  openGraph: {
    title: "Протокол Аудита Вселенной v16",
    description: "Аудит вымышленных миров: 5 блоков, 5 измерений, качественный вердикт без числовых оценок. Free-form markdown отчёт, streaming.",
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
