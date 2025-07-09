import './globals.css'
import { AuthProvider } from '@/context/AuthContext'

export const metadata = {
  title: 'InterviewAI',
  description: 'AI-Powered Interview Platform'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
