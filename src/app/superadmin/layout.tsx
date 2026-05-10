'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/use-auth'
import {
  LayoutDashboard, Building2, CreditCard, Receipt,
  ScrollText, BarChart3, LifeBuoy, Shield, Users,
  Settings2, LogOut,
} from 'lucide-react'

const SA_SESSION_KEY = 'sa-session'

const NAV = [
  { href: '/superadmin/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/superadmin/clients',       label: 'Clientes',       icon: Building2 },
  { href: '/superadmin/subscriptions', label: 'Suscripciones',  icon: CreditCard },
  { href: '/superadmin/billing',       label: 'Facturación',    icon: Receipt },
  { href: '/superadmin/logs',          label: 'Logs',           icon: ScrollText },
  { href: '/superadmin/analytics',     label: 'Analíticas',     icon: BarChart3 },
  { href: '/superadmin/support',       label: 'Soporte',        icon: LifeBuoy },
  { href: '/superadmin/security',      label: 'Seguridad',      icon: Shield },
  { href: '/superadmin/users',         label: 'Usuarios',       icon: Users },
  { href: '/superadmin/config',        label: 'Configuración',  icon: Settings2 },
]

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { authUser, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === '/superadmin/login'
  const [saReady, setSaReady] = useState(false)

  useEffect(() => {
    if (loading) return
    const hasSession = sessionStorage.getItem(SA_SESSION_KEY) === '1'
    if (isLoginPage) {
      if (hasSession && authUser?.role === 'superadmin') router.replace('/superadmin/dashboard')
      else setSaReady(true)
      return
    }
    if (!hasSession || authUser?.role !== 'superadmin') {
      router.replace('/superadmin/login')
      return
    }
    setSaReady(true)
  }, [authUser, loading, router, isLoginPage])

  function handleLogout() {
    sessionStorage.removeItem(SA_SESSION_KEY)
    router.replace('/superadmin/login')
  }

  if (!saReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isLoginPage) return <>{children}</>

  return (
    <div className="min-h-screen flex bg-[#0c0c12]">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 flex flex-col h-screen sticky top-0 bg-[#0f0f17] border-r border-white/[0.06]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-[56px] border-b border-white/[0.06] flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/30">
            <span className="text-white text-[11px] font-bold">SA</span>
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-white/90 leading-tight">Admin Panel</p>
            <p className="text-[10px] text-white/30 leading-tight">Clinify</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[12.5px] font-medium transition-all duration-100',
                  active
                    ? 'bg-violet-500/15 text-violet-300 shadow-sm'
                    : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70'
                )}
              >
                <Icon size={15} className="flex-shrink-0" />
                {label}
                {active && <div className="ml-auto w-1 h-1 rounded-full bg-violet-400" />}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/[0.06] p-3 flex-shrink-0">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-[8px] hover:bg-white/[0.04] transition-colors">
            <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-violet-300 text-[9px] font-bold">SA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] font-medium text-white/60 truncate">{authUser?.user?.email}</p>
              <p className="text-[9px] text-white/25">Superadmin</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="text-white/25 hover:text-red-400 transition-colors"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  )
}
