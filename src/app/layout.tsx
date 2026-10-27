import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  themeColor: "#0a0f11",
  colorScheme: "dark" as const,
};

// Фавикон — фирменный знак, а не эмодзи: та же геометрия, что и в BrandMark.tsx
// и public/logo.svg (рамка документа + три линейки убывающей длины).
const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>" +
      "<rect width='32' height='32' rx='4' fill='#0a0f11'/>" +
      "<rect x='4' y='4' width='24' height='24' rx='3' fill='none' stroke='#8497a0' stroke-width='1.5'/>" +
      "<g fill='#d3dcdd'>" +
      "<rect x='9' y='10' width='14' height='2'/>" +
      "<rect x='9' y='15' width='11' height='2'/>" +
      "<rect x='9' y='20' width='8' height='2'/>" +
      "</g>" +
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
