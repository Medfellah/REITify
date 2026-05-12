import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "REITify — REIT 10-K Analyzer",
  description:
    "Analyze any REIT 10-K filing in under 5 minutes. Four key data points, each with a verbatim source citation.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  )
}
