import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  themeColor: "#0a0f11",
  colorScheme: "dark" as const,
};

// Фавикон — фирменный знак, а не эмодзи: тот же контур, что и в шапке.
const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'>" +
      "<rect x='1' y='1' width='28' height='28' rx='2' fill='#0a0f11' stroke='#8497a0' stroke-width='1'/>" +
      "<path d='M23 7 L12.6 23 H5.7 L16.1 7 Z' fill='#d3dcdd'/>" +
      "</svg>",
  );

export const metadata: Metadata = {
  title: "Протокол Аудита Вселенной v16",
  description: "Качественный аудит вымышленных миров: 5 блоков, 5 связанных измерений, корневые проблемы и приоритетные рекомендации, вердикт в качественных полосах. Free-form markdown, streaming.",
  keywords: ["аудит вселенной", "ворлдбилдинг", "анализ нарратива", "структура истории", "аудит мира", "каузальный аудит", "мир как система"],
  authors: [{ name: "Протокол Аудита Вселенной" }],
  icons: {
    icon: FAVICON,
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
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
      </body>
    </html>
  );
}
