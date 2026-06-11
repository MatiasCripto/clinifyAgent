'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Mail, Lock, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function RegisterForm() {
  const router   = useRouter()
  const supabase = createClient()

  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      })
      if (error) throw error

      // Profile auto-created by DB trigger (org_id = null)
      router.push('/onboarding')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrarse'
      setError(
        message.includes('already registered')
          ? 'Este email ya está registrado'
          : message.includes('weak_password')
          ? 'La contraseña debe tener al menos 6 caracteres'
          : message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-[380px] mx-auto"
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-[#6366f1] to-[#818cf8] flex items-center justify-center mb-3 shadow-lg shadow-indigo-200">
          <span className="text-white text-xl font-bold">O</span>
        </div>
        <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Clinify</h1>
        <p className="text-[13px] text-[var(--subtle)] mt-0.5">Creá tu cuenta</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Full name */}
        <div className="relative">
          <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre completo"
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
          />
        </div>

        {/* Email */}
        <div className="relative">
          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
          <input
            type={showPw ? 'text' : 'password'}
            required
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña (mín. 6 caracteres)"
            className="w-full pl-9 pr-10 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--subtle)] hover:text-[var(--muted)]"
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        {/* Error */}
        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-[8px] px-3 py-2">
            ⚠ {error}
          </motion.p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          Crear cuenta
        </button>
      </form>

      <p className="text-center text-[11px] text-[var(--subtle)] mt-6">
        ¿Ya tenés cuenta?{' '}
        <a href="/login" className="text-[var(--brand)] hover:underline">Ingresá</a>
      </p>
    </motion.div>
  )
}
