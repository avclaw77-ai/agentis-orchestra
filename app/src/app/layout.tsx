import type { Metadata } from "next"
import { Manrope, JetBrains_Mono } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext"],
})

export const metadata: Metadata = {
  title: "AgentisOrchestra",
  description: "Multi-agent orchestration platform -- build, run, and conduct AI agent teams",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
