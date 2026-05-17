'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, Eye, EyeOff, AlertCircle, Pencil, Trash2, KeyRound, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { UserRole } from '@/lib/types'

interface OrgOption { id: string; name: string }

interface UserRow {
  id: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  email: string | null
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  organizations: { id: string; name: string } | null
}

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  owner:      'Propietario',
  admin:      'Admin',
  staff:      'Staff',
  viewer:     'Viewer',
}

const ROLE_BADGE: Record<UserRole, string> = {
  superadmin: 'bg-violet-100 text-violet-700',
  owner:      'bg-indigo-100 text-indigo-700',
  admin:      'bg-blue-100 text-blue-700',
  staff:      'bg-teal-100 text-teal-700',
  viewer:     'bg-gray-100 text-gray-500',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDatetime(iso: string | null) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Password input with show/hide ─────────────────────────────
function PwInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        minLength={8}
        className="w-full px-3 py-2 pr-9 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
      />
      <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)] hover:text-[var(--muted)]">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12.5px] font-medium text-[var(--foreground)]">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
    />
  )
}

function RoleSelect({ value, onChange, exclude = [] }: { value: string; onChange: (v: string) => void; exclude?: UserRole[] }) {
  const roles: UserRole[] = ['owner', 'admin', 'staff', 'viewer']
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--brand)] transition-colors"
    >
      {roles.filter(r => !exclude.includes(r)).map(r => (
        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
      ))}
    </select>
  )
}

// ── Main ──────────────────────────────────────────────────────
export function UsersContent() {
  const searchParams = useSearchParams()
  const initialOrg = searchParams.get('orgId') ?? 'all'
  const [users, setUsers]       = useState<UserRow[]>([])
  const [orgs, setOrgs]         = useState<OrgOption[]>([])
  const [orgFilter, setOrgFilter] = useState<string>(initialOrg)
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<'create' | 'edit' | 'reset-pw' | 'delete' | null>(null)
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)

  // Create form
  const [createForm, setCreateForm] = useState({ orgId: '', fullName: '', email: '', password: '', role: 'staff' })
  // Edit form
  const [editForm, setEditForm] = useState({ fullName: '', role: 'staff', is_active: true })
  // Reset pw
  const [newPw, setNewPw] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const url = orgFilter === 'all' ? '/api/superadmin/users' : `/api/superadmin/users?orgId=${orgFilter}`
    const res = await fetch(url)
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }, [orgFilter])

  useEffect(() => { load() }, [load])

  // Load org list for filter + create form
  useEffect(() => {
    fetch('/api/superadmin/organizations')
      .then(r => r.json())
      .then((data: Array<{ id: string; name: string }>) => setOrgs(data.map(o => ({ id: o.id, name: o.name }))))
  }, [])

  function openEdit(u: UserRow) {
    setSelected(u)
    setEditForm({ fullName: u.full_name, role: u.role, is_active: u.is_active })
    setError(null)
    setModal('edit')
  }

  function openResetPw(u: UserRow) {
    setSelected(u)
    setNewPw('')
    setError(null)
    setModal('reset-pw')
  }

  function openDelete(u: UserRow) {
    setSelected(u)
    setError(null)
    setModal('delete')
  }

  function closeModal() { setModal(null); setSelected(null); setError(null) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const res = await fetch('/api/superadmin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error desconocido'); setSaving(false); return }
    setModal(null)
    setCreateForm({ orgId: '', fullName: '', email: '', password: '', role: 'staff' })
    await load()
    setSaving(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true); setError(null)
    const res = await fetch('/api/superadmin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, ...editForm }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error desconocido'); setSaving(false); return }
    closeModal()
    await load()
    setSaving(false)
  }

  async function handleResetPw(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true); setError(null)
    const res = await fetch('/api/superadmin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, password: newPw }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error desconocido'); setSaving(false); return }
    closeModal()
    setSaving(false)
  }

  async function handleDelete() {
    if (!selected) return
    setSaving(true); setError(null)
    const res = await fetch('/api/superadmin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error desconocido'); setSaving(false); return }
    closeModal()
    await load()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--foreground)]">Usuarios</h1>
          <p className="text-[12px] text-[var(--subtle)] mt-0.5">Todos los usuarios del sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={orgFilter}
            onChange={e => setOrgFilter(e.target.value)}
            className="px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--brand)] transition-colors"
          >
            <option value="all">Todas las organizaciones</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-[10px] border border-[var(--border)] text-[var(--subtle)] hover:text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setError(null); setModal('create') }}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Nuevo usuario
          </button>
        </div>
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
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Estado</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <div className="flex justify-center"><div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" /></div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[12px] text-[var(--subtle)]">No hay usuarios.</td>
                </tr>
              ) : users.map(u => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{u.full_name}</p>
                      <p className="text-[11px] text-[var(--subtle)]">{u.email ?? '—'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{u.organizations?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('badge text-[11px] capitalize', ROLE_BADGE[u.role])}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[var(--muted)]">{formatDatetime(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', u.is_active ? 'text-green-600' : 'text-gray-400')}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', u.is_active ? 'bg-green-500' : 'bg-gray-300')} />
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} title="Editar" className="p-1.5 rounded-[8px] text-[var(--subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => openResetPw(u)} title="Cambiar contraseña" className="p-1.5 rounded-[8px] text-[var(--subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors">
                        <KeyRound size={13} />
                      </button>
                      {u.role !== 'superadmin' && (
                        <button onClick={() => openDelete(u)} title="Eliminar" className="p-1.5 rounded-[8px] text-[var(--subtle)] hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ── */}

      {/* Create user */}
      {modal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] w-full max-w-[440px] shadow-2xl">
            <div className="p-5 border-b border-[var(--border)]">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Nuevo usuario</h2>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
              <Field label="Organización *">
                <select
                  value={createForm.orgId}
                  onChange={e => setCreateForm(f => ({ ...f, orgId: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--brand)] transition-colors"
                >
                  <option value="">Seleccionar...</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              <Field label="Nombre completo *">
                <TextInput value={createForm.fullName} onChange={v => setCreateForm(f => ({ ...f, fullName: v }))} placeholder="Dr. Juan Pérez" />
              </Field>
              <Field label="Email *">
                <TextInput type="email" value={createForm.email} onChange={v => setCreateForm(f => ({ ...f, email: v }))} placeholder="usuario@clinica.com" />
              </Field>
              <Field label="Contraseña inicial *">
                <PwInput value={createForm.password} onChange={v => setCreateForm(f => ({ ...f, password: v }))} />
              </Field>
              <Field label="Rol">
                <RoleSelect value={createForm.role} onChange={v => setCreateForm(f => ({ ...f, role: v }))} />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
                  {saving ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit user */}
      {modal === 'edit' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] w-full max-w-[400px] shadow-2xl">
            <div className="p-5 border-b border-[var(--border)]">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Editar usuario</h2>
              <p className="text-[12px] text-[var(--subtle)] mt-0.5">{selected.email}</p>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
              <Field label="Nombre completo">
                <TextInput value={editForm.fullName} onChange={v => setEditForm(f => ({ ...f, fullName: v }))} />
              </Field>
              <Field label="Rol">
                <RoleSelect value={editForm.role} onChange={v => setEditForm(f => ({ ...f, role: v }))} />
              </Field>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editForm.is_active}
                  onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="is_active" className="text-[13px] text-[var(--foreground)]">Cuenta activa</label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset password */}
      {modal === 'reset-pw' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] w-full max-w-[380px] shadow-2xl">
            <div className="p-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound size={16} className="text-[var(--brand)]" />
                <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Cambiar contraseña</h2>
              </div>
              <p className="text-[12px] text-[var(--subtle)]">{selected.full_name} — {selected.email}</p>
            </div>
            <form onSubmit={handleResetPw} className="p-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
              <Field label="Nueva contraseña">
                <PwInput value={newPw} onChange={setNewPw} placeholder="Mínimo 8 caracteres" />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving || newPw.length < 8} className="px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Actualizar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {modal === 'delete' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] w-full max-w-[360px] shadow-2xl">
            <div className="p-5">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)] mb-1">Eliminar usuario</h2>
              <p className="text-[13px] text-[var(--muted)]">
                ¿Eliminar permanentemente a <strong>{selected.full_name}</strong>? Esta acción no se puede deshacer.
              </p>
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px] mt-3">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={closeModal} className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">Cancelar</button>
                <button onClick={handleDelete} disabled={saving} className="px-4 py-2 rounded-[10px] bg-red-500 text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
                  {saving ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
