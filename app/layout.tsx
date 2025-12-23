import type { Metadata } from "next"
import type React from "react"

import "./globals.css"

import localFont from "next/font/local"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"

// Initialize fonts from local files to avoid network fetches during build
const geist = localFont({
  src: [
    {
      path: "../public/fonts/GeistSans.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-geist-sans",
})

const geistMono = localFont({
  src: [
    {
      path: "../public/fonts/GeistMono.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-geist-mono",
})

const sourceSerif = localFont({
  src: [
    {
      path: "../public/fonts/SourceSerif4.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-source-serif",
})

export const metadata: Metadata = {
  title: "LLM Trader 测试工具",
  description: "LLM Trader 测试和验证工具",
  generator: "v0.app",
  icons: {
    icon: "https://avatars.githubusercontent.com/u/26536442?v=4",
    apple: "https://avatars.githubusercontent.com/u/26536442?v=4",
  },
  manifest: "/manifest.json",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} ${sourceSerif.variable} font-sans antialiased`}>
        {children}
        <PWAInstallPrompt />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                      console.log('[PWA] Service Worker registered:', registration.scope);
                    })
                    .catch((error) => {
                      console.error('[PWA] Service Worker registration failed:', error);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
