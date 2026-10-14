import type { Metadata } from "next"
import { Almarai } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import { ToastProvider } from "@/components/ui/Toast"
import "@/styles/globals.css"

const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700", "800"],
  variable: "--font-almarai",
  display: "swap",
  preload: true,
})

export const metadata: Metadata = {
  title: { default: "يُسر | YUSR - منصة التقويم المدرسي الداخلي", template: "%s | يُسر" },
  description: "منصة يُسر للتقويم المدرسي الداخلي - نقيس • نحلل • نُحسّن",
  icons: {
    icon: '/favicon.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: "يُسر | YUSR - منصة التقويم المدرسي الداخلي",
    description: "منصة يُسر للتقويم المدرسي الداخلي - نقيس • نحلل • نُحسّن",
    url: "https://yusr-platform.com",
    siteName: "YUSR",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'منصة يُسر للتقويم المدرسي الداخلي',
      }
    ],
    locale: 'ar_SA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "يُسر | YUSR - منصة التقويم المدرسي الداخلي",
    description: "منصة يُسر للتقويم المدرسي الداخلي - نقيس • نحلل • نُحسّن",
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${almarai.variable} font-sans antialiased bg-background text-foreground`}>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}