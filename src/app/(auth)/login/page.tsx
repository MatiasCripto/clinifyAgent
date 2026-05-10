import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Ingresar — Clinify' }

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--background)]">
      <LoginForm />
    </main>
  )
}
