import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  themeColor: "#0a0f11",
  colorScheme: "dark" as const,
};

// Favicon matches BrandMark, in a self-contained SVG data URL for static hosting.
const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30' fill='none'>" +
      "<rect x='1.5' y='1.5' width='27' height='27' rx='3.5' fill='#0d1417' stroke='#8497a0' stroke-width='.75'/>" +
      "<g stroke='#d3dcdd' stroke-width='.95' stroke-linecap='round' stroke-linejoin='round'>" +
        "<circle cx='15' cy='15' r='8.1'/>" +
        "<path d='M15 6.9C10.7 9.2 10.7 20.8 15 23.1'/>" +
        "<path d='M15 6.9C19.3 9.2 19.3 20.8 15 23.1'/>" +
        "<path d='M5.1 15c1.8-4.1 22-4.1 23.8 0-1.8 4.1-22 4.1-23.8 0Z'/>" +
        "<circle cx='15' cy='15' r='3.05' fill='#0d1417'/>" +
        "<path d='m13.45 15.05 1.15 1.15 2.05-2.3' stroke-width='1.15'/>" +
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
