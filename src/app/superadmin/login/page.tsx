'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SuperadminLoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)

    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !data.user) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    // Verify superadmin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role !== 'superadmin') {
      await supabase.auth.signOut()
      setError('Esta cuenta no tiene acceso al panel de administración.')
      setLoading(false)
      return
    }

    router.replace('/superadmin')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-[380px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg mb-3">
            <span className="text-white text-[16px] font-bold">SA</span>
          </div>
          <h1 className="text-[20px] font-bold text-[var(--foreground)]">Panel de Administración</h1>
          <p className="text-[13px] text-[var(--subtle)] mt-1">Acceso restringido</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12.5px]">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[12.5px] font-medium text-[var(--foreground)]">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@tuapp.com"
                required
                autoFocus
                className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12.5px] font-medium text-[var(--foreground)]">Contraseña</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 pr-10 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--subtle)] hover:text-[var(--muted)]"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 mt-2"
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
