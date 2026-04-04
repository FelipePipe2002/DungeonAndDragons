import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { MedievalSharp } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AppNav } from '@/components/app-nav'
import { AppSubnav } from '@/components/app-subnav'
import { AppGlobalOverlays } from '@/components/app-global-overlays'
import { GlobalNavigationShortcuts } from '@/components/global-navigation-shortcuts'
import { NavSettingsSheet } from '@/components/nav-settings-sheet'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _medieval = MedievalSharp({ weight: "400", subsets: ["latin"] });
const shouldEnableVercelAnalytics =
  process.env.VERCEL === "1" || process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "1"

export const metadata: Metadata = {
  title: 'DM Codex - Herramienta de Dungeon Master',
  description: 'Herramienta para gestionar tu campana de D&D',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport = {
  themeColor: '#ddd0b8',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col">
          <GlobalNavigationShortcuts />
          <NavSettingsSheet showTrigger={false} />
          <AppNav />
          <AppSubnav />
          <main className="flex-1">
            {children}
          </main>
        </div>
        <AppGlobalOverlays />
        {shouldEnableVercelAnalytics ? <Analytics /> : null}
      </body>
    </html>
  )
}
