import type { Metadata } from "next";
import "./globals.css";

export const viewport = { themeColor: "#0a0f11", colorScheme: "dark" };

export const metadata: Metadata = {
  title: "Протокол Аудита Вселенной v3",
  description: "Анализ вымышленных миров через 5 последовательных блоков: Ориентация, Механизм, Тело+Психика, Мета, Синтез. Free-form markdown, streaming.",
  keywords: ["аудит вселенной", "ворлдбилдинг", "анализ нарратива", "структура истории", "архитектура горя", "анализ персонажей"],
  authors: [{ name: "Протокол Аудита Вселенной" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Протокол Аудита Вселенной v3",
    description: "Анализ вымышленных миров через 5 блоков и 4 уровня: free-form markdown отчёт, streaming, без гейтов.",
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
        className="antialiased bg-background text-foreground min-h-screen"
      >
        {children}
      </body>
    </html>
  );
}
