import { Inter } from 'next/font/google'
import "./globals.css"
import dynamic from "next/dynamic"
import { Toaster } from 'react-hot-toast'

const Header = dynamic(() => import('@/components/Header'), {
  ssr: false,
  loading: () => <header className="h-[76px] border-b border-gray-200 bg-white" />,
})

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Header />
          <div className="flex flex-1">
            <main className="flex-1 p-4 lg:p-8 transition-all duration-300">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  )
}
