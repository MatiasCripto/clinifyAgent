'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { useAuth } from '@/lib/hooks/use-auth'
import { AlertCircle } from 'lucide-react'

function SuspendedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-6">
      <div className="max-w-[420px] w-full text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-[20px] font-bold text-[var(--foreground)]">Cuenta suspendida</h1>
          <p className="text-[14px] text-[var(--muted)] leading-relaxed">
            El acceso a esta plataforma ha sido suspendido. Por favor contactate con soporte técnico para regularizar tu suscripción.
          </p>
        </div>
        <div className="p-4 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] text-left space-y-1">
          <p className="text-[12px] font-semibold text-[var(--foreground)]">Soporte técnico</p>
          <p className="text-[12px] text-[var(--muted)]">📧 scaronejonatan@gmail.com</p>
          <p className="text-[12px] text-[var(--muted)]">📱 WhatsApp: +54 9 11 6806-2699</p>
        </div>
        <p className="text-[11px] text-[var(--subtle)]">Código de error: ORG_INACTIVE</p>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { authUser, loading } = useAuth()

  // Must be before any early return — Rules of Hooks
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Superadmin must use /superadmin, not the client dashboard
  if (!loading && authUser?.role === 'superadmin') {
    if (typeof window !== 'undefined') window.location.replace('/superadmin')
    return null
  }

  if (!loading && authUser?.organization?.is_active === false) {
    return <SuspendedScreen />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless drawer is open */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-40 md:relative md:z-auto',
          'transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <Sidebar
          collapsed={collapsed}
          onMobileClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          sidebarCollapsed={collapsed}
          onToggleSidebar={() => {
            if (window.innerWidth < 768) {
              setMobileOpen(v => !v)
            } else {
              setCollapsed(v => !v)
            }
          }}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
