import type { Metadata } from 'next'
import { RegisterForm } from './register-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Crear cuenta — Clinify' }

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--background)]">
      <RegisterForm />
    </main>
  )
}
