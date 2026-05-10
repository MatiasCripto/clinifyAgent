'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import {
  LayoutDashboard, CalendarDays, Clock, Users,
  Stethoscope, MessageSquare, BarChart3, Settings,
  LogOut, Moon, Sun, Receipt,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/hooks/use-auth'
import { getInitials } from '@/lib/utils/formatters'

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
  const { authUser, signOut } = useAuth()

  const orgName   = authUser?.organization?.name || 'Clinify'
  const userName  = authUser?.profile?.full_name ?? 'Admin'
  const userEmail = authUser?.user?.email ?? 'admin@clinify.app'
  const avatarUrl = authUser?.profile?.avatar_url ?? null

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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
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
    </aside>
  )
}
