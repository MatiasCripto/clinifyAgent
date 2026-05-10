'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

type Mode = 'login' | 'magic'

export function LoginForm() {
  const router   = useRouter()
  const supabase = createClient()

  const [mode,     setMode]     = useState<Mode>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(null); setLoading(true)

    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/overview` },
        })
        if (error) throw error
        setSuccess('Te enviamos un link de acceso a tu email. ¡Revisá tu bandeja!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/overview')
        router.refresh()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión'
      setError(
        message.includes('Invalid login')
          ? 'Email o contraseña incorrectos'
          : message.includes('Email not confirmed')
          ? 'Confirmá tu email antes de ingresar'
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
        <p className="text-[13px] text-[var(--subtle)] mt-0.5">Ingresá a tu cuenta</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-[10px] bg-[var(--surface-2)] mb-5">
        {(['login', 'magic'] as Mode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); setSuccess(null) }}
            className={cn(
              'flex-1 py-1.5 rounded-[8px] text-[13px] font-medium transition-all',
              mode === m
                ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            {m === 'login' ? '🔐 Contraseña' : '✉️ Magic Link'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
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

        {/* Password (login mode only) */}
        {mode === 'login' && (
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
            <input
              type={showPw ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
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
        )}

        {/* Error / Success */}
        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-[8px] px-3 py-2">
            ⚠ {error}
          </motion.p>
        )}
        {success && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px] text-green-700 bg-green-50 border border-green-100 rounded-[8px] px-3 py-2">
            ✅ {success}
          </motion.p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {mode === 'login' ? 'Ingresar' : 'Enviar Magic Link'}
        </button>
      </form>

      <p className="text-center text-[11px] text-[var(--subtle)] mt-6">
        ¿Problemas para ingresar? Contactá a tu administrador.
      </p>
    </motion.div>
  )
}
