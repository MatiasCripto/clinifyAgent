'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, Building2, Stethoscope, Phone, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [clinicName, setClinicName] = useState('')
  const [specialty, setSpecialty]   = useState('')
  const [phone, setPhone]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [checking, setChecking]     = useState(true)
  const [error, setError]           = useState<string | null>(null)

  // Check if user already has an org — skip onboarding
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/login')
        return
      }

      // If user already has a profile with organization_id, skip onboarding
      ;(async () => {
        const { data } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', session.user.id)
          .single()
        if (data?.organization_id) {
          router.push('/overview')
        } else {
          setChecking(false)
        }
      })()
    })
  }, [router, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)

    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: clinicName.trim(),
          specialty: specialty.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear tu clínica')

      // Force session refresh so the auth context picks up the new org
      await supabase.auth.refreshSession()
      router.push('/overview')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--background)]">
        <Loader2 size={24} className="animate-spin text-[var(--muted)]" />
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--background)]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-[420px] mx-auto"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-[#6366f1] to-[#818cf8] flex items-center justify-center mb-3 shadow-lg shadow-indigo-200">
            <span className="text-white text-xl font-bold">O</span>
          </div>
          <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Configurá tu clínica</h1>
          <p className="text-[13px] text-[var(--subtle)] mt-0.5 text-center max-w-[300px]">
            Estos datos los vas a poder modificar después desde configuración.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Clinic name */}
          <div className="relative">
            <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
            <input
              type="text"
              required
              value={clinicName}
              onChange={e => setClinicName(e.target.value)}
              placeholder="Nombre de la clínica"
              className="w-full pl-9 pr-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
            />
          </div>

          {/* Main specialty */}
          <div className="relative">
            <Stethoscope size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
            <input
              type="text"
              value={specialty}
              onChange={e => setSpecialty(e.target.value)}
              placeholder="Especialidad principal (ej: Odontología)"
              className="w-full pl-9 pr-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
            />
          </div>

          {/* Phone */}
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Teléfono (ej: +54 9 11 1234-5678)"
              className="w-full pl-9 pr-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-[8px] px-3 py-2"
            >
              ⚠ {error}
            </motion.p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !clinicName.trim()}
            className="w-full py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <ArrowRight size={15} />
            )}
            {loading ? 'Creando...' : 'Ir al dashboard'}
          </button>
        </form>
      </motion.div>
    </main>
  )
}
