'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import {
  LayoutDashboard, CalendarDays, Clock, Users,
  Stethoscope, MessageSquare, BarChart3, Settings,
  LogOut, Moon, Sun, Receipt, CheckCircle2,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/hooks/use-auth'
import { getInitials } from '@/lib/utils/formatters'
import { ClinicSelector } from '@/components/layout/clinic-selector'
import { usePlan } from '@/lib/plans/use-plan'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/overview',       label: 'Inicio',        icon: LayoutDashboard },
  { href: '/calendar',       label: 'Calendario',    icon: CalendarDays },
  { href: '/appointments',   label: 'Turnos',        icon: Clock },
  { href: '/patients',       label: 'Pacientes',     icon: Users },
  { href: '/professionals',  label: 'Profesionales', icon: Stethoscope },
  { href: '/messages',       label: 'WhatsApp Bot',  icon: MessageSquare },
  { href: '/billing',        label: 'Facturación',   icon: Receipt },
  { href: '/analytics',      label: 'Analytics',     icon: BarChart3 },
  { href: '/settings',       label: 'Configuración', icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ collapsed = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { authUser, signOut, currentClinic, setCurrentClinic, loading } = useAuth()
  const { canAddClinic, hasMultiSucursal, limits, upgradeLabel, plan } = usePlan()

  // Support contact modal
  const [showContact, setShowContact] = useState(false)
  const [contactTitle, setContactTitle] = useState('')
  const [contactDesc, setContactDesc] = useState('')
  const [contactSending, setContactSending] = useState(false)
  const [contactSent, setContactSent] = useState(false)

  async function handleSubmitContact() {
    if (!contactTitle.trim() || !contactDesc.trim()) return
    setContactSending(true)
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: contactTitle.trim(), description: contactDesc.trim() }),
    })
    if (res.ok) {
      setContactSent(true)
      setTimeout(() => { setShowContact(false); setContactSent(false); setContactTitle(''); setContactDesc('') }, 2000)
    }
    setContactSending(false)
  }

  // Clinic creation modal
  const [showAddClinic, setShowAddClinic] = useState(false)
  const [newClinicName, setNewClinicName] = useState('')
  const [savingClinic, setSavingClinic] = useState(false)
  const [clinicError, setClinicError] = useState<string | null>(null)

  const orgName   = authUser?.organization?.name || 'Clinify'
  const userName  = authUser?.profile?.full_name ?? 'Admin'
  const userEmail = authUser?.user?.email ?? 'admin@clinify.app'
  const avatarUrl = authUser?.profile?.avatar_url ?? null
  const userRole  = authUser?.role

  // Staff sees only: Inicio, Calendario, Turnos, Pacientes, WhatsApp Bot, Configuración
  const staffHidden = new Set(['professionals', 'billing', 'analytics'])
  const visibleItems = userRole === 'staff'
    ? NAV_ITEMS.filter(item => !staffHidden.has(item.href.replace(/^\//, '')))
    : NAV_ITEMS

  const clinics = authUser?.clinics ?? []

  async function handleAddClinic() {
    if (!newClinicName.trim()) return
    setSavingClinic(true)
    setClinicError(null)
    const res = await fetch('/api/settings/clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClinicName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setClinicError(data.error ?? 'Error al crear la clínica')
      setSavingClinic(false)
      return
    }
    // Reload page to refresh clinics list
    window.location.reload()
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-[var(--surface)] border-r border-[var(--border)]',
        'transition-all duration-200 ease-in-out select-none',
        collapsed ? 'w-[64px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-[60px] border-b border-[var(--border)] flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#818cf8] flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white text-sm font-bold">{orgName.charAt(0).toUpperCase()}</span>
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <p className="font-bold text-[13px] text-[var(--foreground)] leading-tight whitespace-nowrap">{orgName}</p>
              <p className="text-[10px] text-[var(--subtle)] leading-tight tracking-wide uppercase">Clínica</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Clinic selector — only show when user has clinics and is not superadmin */}
      {!loading && userRole !== 'superadmin' && clinics.length > 0 && (
        <ClinicSelector
          clinics={clinics}
          currentClinic={currentClinic}
          onSelect={setCurrentClinic}
          collapsed={collapsed}
          onAddClinic={() => {
            setNewClinicName('')
            setClinicError(null)
            setShowAddClinic(true)
          }}
          canAddClinic={canAddClinic(clinics.length)}
          hasMultiSucursal={hasMultiSucursal}
        />
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium',
                'transition-all duration-100 group relative',
                active
                  ? 'bg-[var(--brand-subtle)] text-[var(--brand)] dark:bg-[#1a1f6e] dark:text-[#818cf8]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon
                className={cn(
                  'flex-shrink-0 transition-colors',
                  active ? 'text-[var(--brand)]' : 'text-[var(--subtle)] group-hover:text-[var(--muted)]'
                )}
                size={18}
              />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.12 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-[10px] bg-[var(--brand-subtle)] dark:bg-[#1a1f6e] -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] p-2 space-y-1 flex-shrink-0">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-[12.5px] font-medium',
            'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors',
            collapsed && 'justify-center px-2'
          )}
        >
          {mounted && (resolvedTheme === 'dark'
            ? <Sun size={16} className="flex-shrink-0" />
            : <Moon size={16} className="flex-shrink-0" />)}
          {!collapsed && mounted && <span>Tema {resolvedTheme === 'dark' ? 'claro' : 'oscuro'}</span>}
        </button>

        {/* Support — plan-aware */}
        {plan === 'enterprise' ? (
          <a
            href="https://wa.me/5491168062699"
            target="_blank"
            rel="noreferrer"
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-[12.5px] font-medium',
              'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors',
              collapsed && 'justify-center px-2'
            )}
            title="Soporte prioritario por WhatsApp"
          >
            <span className="text-[15px] flex-shrink-0">💬</span>
            {!collapsed && <span>Soporte WhatsApp</span>}
          </a>
        ) : plan === 'pro' ? (
          <button
            type="button"
            onClick={() => { setContactTitle(''); setContactDesc(''); setContactSent(false); setShowContact(true) }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-[12.5px] font-medium',
              'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors',
              collapsed && 'justify-center px-2'
            )}
            title="Soporte por email — 24h"
          >
            <span className="text-[15px] flex-shrink-0">📧</span>
            {!collapsed && <span>Soporte Email</span>}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-[12.5px] font-medium',
              'text-[var(--subtle)] opacity-50 cursor-not-allowed',
              collapsed && 'justify-center px-2'
            )}
            title="Soporte por email disponible en plan Pro"
          >
            <span className="text-[15px] flex-shrink-0">📧</span>
            {!collapsed && <span>Soporte Email</span>}
          </button>
        )}

        {/* User + logout */}
        <div className={cn('flex items-center gap-2.5 px-3 py-2 rounded-[10px] group', collapsed && 'justify-center px-2')}>
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-[#6366f1] to-[#818cf8] flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-[11px] font-bold">{getInitials(userName)}</span>
            )}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[var(--foreground)] truncate">{userName}</p>
                <p className="text-[10px] text-[var(--subtle)] truncate">{userEmail}</p>
              </div>
              <button
                onClick={signOut}
                title="Cerrar sesión"
                className="text-[var(--subtle)] hover:text-red-500 transition-colors p-0.5"
              >
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add Clinic Modal */}
      {showAddClinic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowAddClinic(false)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] w-full max-w-[380px] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <p className="text-[14px] font-semibold text-[var(--foreground)] mb-4">Agregar sucursal</p>
            {clinicError && (
              <div className="mb-4 p-3 rounded-[8px] bg-red-50 border border-red-200 text-red-700 text-[12px]">{clinicError}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Nombre de la sucursal *</label>
                <input
                  value={newClinicName}
                  onChange={e => setNewClinicName(e.target.value)}
                  placeholder="Ej: Sucursal Centro"
                  className="w-full px-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleAddClinic()}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowAddClinic(false)}
                  className="px-4 py-2 rounded-[8px] border border-[var(--border)] text-[12.5px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddClinic}
                  disabled={savingClinic || !newClinicName.trim()}
                  className="px-4 py-2 rounded-[8px] bg-[var(--brand)] text-white text-[12.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {savingClinic ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Support Contact Modal — Pro plan */}
      {showContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowContact(false)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] w-full max-w-[400px] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <p className="text-[14px] font-semibold text-[var(--foreground)] mb-1">Soporte por email</p>
            <p className="text-[12px] text-[var(--subtle)] mb-4">Te respondemos en menos de 24 horas.</p>
            {contactSent ? (
              <div className="flex items-center gap-2 p-3 rounded-[10px] bg-green-50 border border-green-200 text-green-700 text-[13px]">
                <CheckCircle2 size={16} /> Mensaje enviado. Te contactaremos pronto.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Asunto *</label>
                  <input
                    value={contactTitle}
                    onChange={e => setContactTitle(e.target.value)}
                    placeholder="Ej: Error al cargar un turno"
                    className="w-full px-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Descripción *</label>
                  <textarea
                    rows={4}
                    value={contactDesc}
                    onChange={e => setContactDesc(e.target.value)}
                    placeholder="Describí el problema o consulta..."
                    className="w-full px-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowContact(false)}
                    className="px-4 py-2 rounded-[8px] border border-[var(--border)] text-[12.5px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmitContact}
                    disabled={contactSending || !contactTitle.trim() || !contactDesc.trim()}
                    className="px-4 py-2 rounded-[8px] bg-[var(--brand)] text-white text-[12.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {contactSending ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
