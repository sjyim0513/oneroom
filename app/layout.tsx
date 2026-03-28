import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";

import { SiteNav } from "@/components/layout/site-nav";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "원룸 플래너",
  description: "면 편집, 가구 제작, 방 구성을 위한 인테리어 레이아웃 플래너입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <div className="min-h-screen px-4 py-5 md:px-6 lg:px-8">
          <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1600px] flex-col gap-4 rounded-[28px] border border-white/60 bg-white/40 p-4 shadow-panel backdrop-blur md:p-5">
            <SiteNav />
            <main className="flex-1 overflow-hidden rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-bg)]">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
