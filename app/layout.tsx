import type { Metadata } from "next"
import type React from "react"

import "./globals.css"

import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"

// Initialize fonts
const _geist = Geist({ subsets: ["latin"], weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] })
const _geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
})
const _sourceSerif_4 = Source_Serif_4({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
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
      <body className={`font-sans antialiased`}>
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
