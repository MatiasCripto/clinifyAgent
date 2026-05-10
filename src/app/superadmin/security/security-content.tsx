'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ShieldCheck, ShieldAlert, LogOut, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { UserRole } from '@/lib/types'

interface SecurityRow {
  id: string
  email: string | null
  full_name: string
  role: UserRole
  is_active: boolean
  org_name: string
  organization_id: string
  last_sign_in_at: string | null
  created_at: string
  email_confirmed_at: string | null
  provider: string
  last_ip: string | null
  last_device: string | null
  last_login_at: string | null
}

const ROLE_BADGE: Record<UserRole, string> = {
  superadmin: 'bg-violet-100 text-violet-700',
  owner:      'bg-indigo-100 text-indigo-700',
  admin:      'bg-blue-100 text-blue-700',
  staff:      'bg-teal-100 text-teal-700',
  viewer:     'bg-gray-100 text-gray-500',
}

function formatDatetime(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'Hace un momento'
  if (mins < 60)  return `Hace ${mins} min`
  const hs = Math.floor(mins / 60)
  if (hs < 24)    return `Hace ${hs} h`
  const ds = Math.floor(hs / 24)
  if (ds < 30)    return `Hace ${ds} d`
  return formatDatetime(iso) ?? '—'
}

// Users considered "recently active" = signed in within the last 24 h
function isRecentlyActive(iso: string | null) {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number
  icon: React.ComponentType<{ size?: number; className?: string }>; color: string
}) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={cn('w-10 h-10 rounded-[10px] flex items-center justify-center', color)}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[22px] font-bold text-[var(--foreground)] leading-none">{value}</p>
        <p className="text-[12px] text-[var(--subtle)] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export function SecurityContent() {
  const [rows, setRows]         = useState<SecurityRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [kicking, setKicking]   = useState<string | null>(null)
  const [toast, setToast]       = useState<string | null>(null)
  const [filterOrg, setFilterOrg] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/superadmin/security')
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function forceLogout(row: SecurityRow) {
    setKicking(row.id)
    const res = await fetch('/api/superadmin/security', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id }),
    })
    if (res.ok) {
      showToast(`Sesiones de ${row.full_name} cerradas correctamente.`)
    } else {
      const j = await res.json()
      showToast(`Error: ${j.error}`)
    }
    setKicking(null)
  }

  // Build org list for filter
  const orgOptions = Array.from(new Map(rows.map(r => [r.organization_id, r.org_name])).entries())

  const displayed = filterOrg === 'all' ? rows : rows.filter(r => r.organization_id === filterOrg)

  const recentCount = rows.filter(r => isRecentlyActive(r.last_sign_in_at)).length
  const unconfirmed = rows.filter(r => !r.email_confirmed_at).length
  const inactive    = rows.filter(r => !r.is_active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--foreground)]">Seguridad</h1>
          <p className="text-[12px] text-[var(--subtle)] mt-0.5">Actividad de sesiones y estado de cuentas</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterOrg}
            onChange={e => setFilterOrg(e.target.value)}
            className="px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--brand)] transition-colors"
          >
            <option value="all">Todas las organizaciones</option>
            {orgOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-[10px] border border-[var(--border)] text-[var(--subtle)] hover:text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Activos últimas 24 h" value={recentCount} icon={Clock}        color="bg-green-100 text-green-600" />
        <StatCard label="Email sin confirmar"   value={unconfirmed} icon={ShieldAlert}  color="bg-amber-100 text-amber-600" />
        <StatCard label="Cuentas inactivas"     value={inactive}    icon={XCircle}      color="bg-gray-100 text-gray-500" />
      </div>

      {/* Notice */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-[12px] bg-blue-50 border border-blue-100 text-blue-700 text-[12px]">
        <ShieldCheck size={15} className="flex-shrink-0 mt-0.5" />
        <p>
          <strong>Último acceso</strong> muestra cuándo cada usuario inició sesión por última vez.
          El botón <strong>Cerrar sesión</strong> invalida todos los tokens activos de esa cuenta de inmediato.
          El registro de IPs y dispositivos requiere middleware adicional.
        </p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Usuario</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Organización</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Rol</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Último acceso</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Email</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Cuenta</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Dispositivo</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Última IP</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center">
                    <div className="flex justify-center"><div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" /></div>
                  </td>
                </tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[12px] text-[var(--subtle)]">No hay datos.</td>
                </tr>
              ) : displayed.map(r => {
                const recent = isRecentlyActive(r.last_sign_in_at)
                return (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', recent ? 'bg-green-400' : 'bg-gray-300')} />
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{r.full_name}</p>
                          <p className="text-[11px] text-[var(--subtle)]">{r.email ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{r.org_name}</td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-[11px]', ROLE_BADGE[r.role])}>{r.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[12px]', recent ? 'text-green-600 font-medium' : 'text-[var(--muted)]')}>
                        {timeAgo(r.last_sign_in_at)}
                      </span>
                      {r.last_sign_in_at && (
                        <p className="text-[11px] text-[var(--subtle)]">{formatDatetime(r.last_sign_in_at)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.email_confirmed_at ? (
                        <span className="flex items-center gap-1 text-[12px] text-green-600">
                          <CheckCircle2 size={13} /> Confirmado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[12px] text-amber-600">
                          <AlertCircle size={13} /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('flex items-center gap-1 text-[12px] font-medium', r.is_active ? 'text-green-600' : 'text-gray-400')}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', r.is_active ? 'bg-green-500' : 'bg-gray-300')} />
                        {r.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-[var(--muted)]">{r.last_device ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.last_ip ? (
                        <span className="font-mono text-[12px] text-[var(--muted)]">{r.last_ip}</span>
                      ) : (
                        <span className="text-[12px] text-[var(--subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => forceLogout(r)}
                        disabled={kicking === r.id}
                        title="Cerrar todas las sesiones activas"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <LogOut size={12} />
                        {kicking === r.id ? '...' : 'Cerrar sesión'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-[12px] bg-[var(--foreground)] text-[var(--background)] text-[13px] shadow-xl animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  )
}
