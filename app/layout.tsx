import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// START_MODULE_CONTRACT
// Input: Next.js app layout context и React children (React.ReactNode).
// Intent: Определить корневой layout приложения и подключить глобальные стили/шрифты.
// Output: Гарантирует стабильный HTML-каркас (<html>/<body>) для всех страниц.
// END_MODULE_CONTRACT

// START_MODULE_MAP
// 1) Конфигурация шрифтов: geistSans, geistMono.
// 2) Метаданные приложения: metadata.
// 3) Корневой компонент: RootLayout(children) => JSX.
// END_MODULE_MAP

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Training Diary MVP",
  description: "MVP for importing and tracking training plans",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // START_CONTRACT_ROOTLAYOUT
  // Input: children: React.ReactNode — дочерние элементы маршрутов Next.js.
  // Intent: Собрать корневую HTML-обёртку и применить переменные шрифтов ко всему приложению.
  // Output: Возвращает JSX-каркас документа; side effect: фиксирует belief-лог рендера layout.
  // END_CONTRACT_ROOTLAYOUT
  console.debug(
    "[app/layout.tsx][RootLayout] Belief: Build root HTML shell with global fonts | Input: children: React.ReactNode | Expected: Stable html/body wrapper with injected font variables",
  );

  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
