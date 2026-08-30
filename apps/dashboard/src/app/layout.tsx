import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { checkEnv } from "@/lib/env-check";
import "./globals.css";
import "@/styles/tailwind.generated.css";

checkEnv();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#2f6b5f",
};

export const metadata: Metadata = {
  title: "家庭驾驶舱",
  description: "家庭生活知识系统",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "家庭驾驶舱",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <Script id="sw-register" strategy="afterInteractive">
        {`if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js')}`}
      </Script>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
