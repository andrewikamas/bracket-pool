import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '2026 NCAA Bracket Pool',
  description: 'Family bracket pool for March Madness 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
