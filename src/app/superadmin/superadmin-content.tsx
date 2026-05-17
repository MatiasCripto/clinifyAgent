'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, RefreshCw, Building2, Users, CheckCircle, XCircle, Eye, EyeOff, AlertCircle, Pencil, Check, X, Trash2, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Organization, Clinic, Profile, OrgPlan } from '@/lib/types'

// ── Types ────────────────────────────────────────────────────
interface OrgRow extends Organization {
  profiles: Profile[]
  clinics: Clinic[]
}

interface CreateForm {
  orgName: string
  clinicName: string
  ownerName: string
  email: string
  password: string
  plan: OrgPlan
}

const EMPTY_FORM: CreateForm = {
  orgName: '', clinicName: '', ownerName: '', email: '', password: '', plan: 'starter',
}

// ── Helpers ──────────────────────────────────────────────────
const PLAN_BADGE: Record<OrgPlan, string> = {
  starter:    'bg-gray-100 text-gray-600',
  pro:        'bg-indigo-100 text-indigo-700',
  enterprise: 'bg-amber-100 text-amber-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Sub-components ───────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }) {
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

function Input({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  const [showPw, setShowPw] = useState(false)
  const isPassword = props.type === 'password'
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[12.5px] font-medium text-[var(--foreground)]">{label}</label>}
      <div className="relative">
        <input
          {...props}
          type={isPassword && showPw ? 'text' : props.type}
          className={cn(
            'w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]',
            'text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors',
            isPassword && 'pr-9'
          )}
        />
        {isPassword && (
          <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)] hover:text-[var(--muted)]">
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-[var(--subtle)]">{hint}</p>}
    </div>
  )
}

// ── Inline name editor ───────────────────────────────────────
function InlineOrgName({ orgId, name, onSave }: { orgId: string; name: string; onSave: (id: string, name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() { setValue(name); setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }
  function cancel() { setEditing(false) }

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === name) { setEditing(false); return }
    setSaving(true)
    await fetch('/api/superadmin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orgId, name: trimmed }),
    })
    onSave(orgId, trimmed)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="w-[140px] px-2 py-0.5 rounded-[6px] bg-[var(--surface-2)] border border-[var(--brand)] text-[13px] text-[var(--foreground)] outline-none"
        />
        <button onClick={save} disabled={saving} className="p-1 rounded text-green-600 hover:bg-green-50 transition-colors">
          <Check size={13} />
        </button>
        <button onClick={cancel} className="p-1 rounded text-[var(--subtle)] hover:bg-[var(--surface-2)] transition-colors">
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 group">
      <p className="font-medium text-[var(--foreground)]">{name}</p>
      <button
        onClick={startEdit}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--subtle)] hover:text-[var(--muted)] transition-all"
        title="Editar nombre"
      >
        <Pencil size={11} />
      </button>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export function SuperadminContent() {
  const [orgs, setOrgs]         = useState<OrgRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]         = useState<CreateForm>(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)
  const [newClinicName, setNewClinicName] = useState('')
  const [addingClinicFor, setAddingClinicFor] = useState<string | null>(null)
  const [editingClinic, setEditingClinic] = useState<{ orgId: string; clinicId: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/superadmin/organizations')
    if (res.ok) setOrgs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const active   = orgs.filter(o => o.is_active).length
  const inactive = orgs.filter(o => !o.is_active).length

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const res = await fetch('/api/superadmin/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error desconocido'); setSaving(false); return }
    setShowModal(false)
    setForm(EMPTY_FORM)
    await load()
    setSaving(false)
  }

  async function toggleActive(org: OrgRow) {
    setTogglingId(org.id)
    await fetch('/api/superadmin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: org.id, is_active: !org.is_active }),
    })
    setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, is_active: !o.is_active } : o))
    setTogglingId(null)
  }

  async function changePlan(orgId: string, plan: OrgPlan) {
    await fetch('/api/superadmin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orgId, plan }),
    })
    setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, plan } : o))
  }

  function renameOrg(orgId: string, name: string) {
    setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, name } : o))
  }

  async function handleDeleteOrg(orgId: string, orgName: string) {
    setDeletingId(orgId)
    const res = await fetch('/api/superadmin/organizations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orgId }),
    })
    if (res.ok) {
      setOrgs(prev => prev.filter(o => o.id !== orgId))
      setShowDeleteConfirm(null)
    } else {
      const json = await res.json()
      setError(json.error ?? 'Error al eliminar')
    }
    setDeletingId(null)
  }

  async function handleRenameClinic(orgId: string, clinicId: string, newName: string) {
    await fetch('/api/superadmin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, clinicName: newName }),
    })
    setOrgs(prev => prev.map(o => {
      if (o.id !== orgId) return o
      return { ...o, clinics: o.clinics?.map(c => c.id === clinicId ? { ...c, name: newName } : c) ?? [] }
    }))
    setEditingClinic(null)
  }

  async function handleAddClinic(orgId: string) {
    if (!newClinicName.trim()) return
    const res = await fetch('/api/superadmin/organizations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId, name: newClinicName.trim() }),
    })
    if (res.ok) {
      const clinic = await res.json()
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, clinics: [...(o.clinics ?? []), clinic] } : o))
      setNewClinicName('')
      setAddingClinicFor(null)
    }
  }

  async function handleDeleteClinic(orgId: string, clinicId: string) {
    await fetch('/api/superadmin/organizations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId }),
    })
    setOrgs(prev => prev.map(o => {
      if (o.id !== orgId) return o
      return { ...o, clinics: o.clinics?.filter(c => c.id !== clinicId) ?? [] }
    }))
  }

  function setField(field: keyof CreateForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--foreground)]">Clientes</h1>
          <p className="text-[12px] text-[var(--subtle)] mt-0.5">Organizaciones registradas en la plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-[10px] border border-[var(--border)] text-[var(--subtle)] hover:text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setShowModal(true); setError(null) }}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Nuevo cliente
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total clientes"  value={orgs.length} icon={Building2}    color="bg-indigo-100 text-indigo-600" />
        <StatCard label="Activos"         value={active}      icon={CheckCircle}  color="bg-green-100 text-green-600" />
        <StatCard label="Inactivos"       value={inactive}    icon={XCircle}      color="bg-gray-100 text-gray-500" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Organización</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Clínica</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Plan</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Usuarios</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">WhatsApp</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Creado</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Estado</th>
                <th className="text-right px-4 py-3 text-[12px] font-medium text-[var(--subtle)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--subtle)]">
                    <div className="flex justify-center"><div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" /></div>
                  </td>
                </tr>
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[12px] text-[var(--subtle)]">
                    No hay clientes todavía. Creá el primero.
                  </td>
                </tr>
              ) : orgs.map(org => {
                const clinic  = org.clinics?.[0]
                const owner   = org.profiles?.find(p => p.role === 'owner')
                const userCount = org.profiles?.length ?? 0
                const hasWA   = !!clinic?.whatsapp_number
                return (
                  <tr key={org.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#818cf8] flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[10px] font-bold">{org.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <InlineOrgName orgId={org.id} name={org.name} onSave={renameOrg} />
                          <p className="text-[11px] text-[var(--subtle)]">{owner?.full_name ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {org.clinics && org.clinics.length > 0 ? (
                        <div className="space-y-1.5">
                          {org.clinics.map(c => (
                            <div key={c.id} className="flex items-center gap-1 group">
                              {editingClinic?.clinicId === c.id ? (
                                <>
                                  <input
                                    defaultValue={editingClinic.name}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleRenameClinic(org.id, c.id, (e.target as HTMLInputElement).value)
                                      if (e.key === 'Escape') setEditingClinic(null)
                                    }}
                                    className="w-[110px] px-1.5 py-0.5 rounded-[6px] bg-[var(--surface-2)] border border-[var(--brand)] text-[12px] outline-none"
                                    autoFocus
                                  />
                                  <button onClick={() => setEditingClinic(null)} className="p-0.5 text-[var(--subtle)]"><X size={11} /></button>
                                </>
                              ) : (
                                <>
                                  <span className="text-[12px] text-[var(--foreground)]">{c.name}</span>
                                  <button
                                    onClick={() => setEditingClinic({ orgId: org.id, clinicId: c.id, name: c.name })}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--subtle)] hover:text-[var(--muted)]"
                                    title="Editar clínica"
                                  ><Pencil size={10} /></button>
                                  {org.clinics!.length > 1 && (
                                    <button
                                      onClick={() => handleDeleteClinic(org.id, c.id)}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600"
                                      title="Eliminar clínica"
                                    ><X size={10} /></button>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                          {addingClinicFor === org.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={newClinicName}
                                onChange={e => setNewClinicName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddClinic(org.id); if (e.key === 'Escape') { setAddingClinicFor(null); setNewClinicName('') } }}
                                placeholder="Nombre nueva clínica"
                                className="w-[130px] px-1.5 py-0.5 rounded-[6px] bg-[var(--surface-2)] border border-[var(--brand)] text-[12px] outline-none"
                                autoFocus
                              />
                              <button onClick={() => handleAddClinic(org.id)} className="p-0.5 text-green-600"><Check size={11} /></button>
                              <button onClick={() => { setAddingClinicFor(null); setNewClinicName('') }} className="p-0.5 text-[var(--subtle)]"><X size={11} /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAddingClinicFor(org.id)}
                              className="flex items-center gap-0.5 text-[10px] text-[var(--brand)] hover:underline mt-0.5"
                            ><Plus size={10} /> Agregar clínica</button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[12px] text-[var(--subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={org.plan}
                        onChange={e => changePlan(org.id, e.target.value as OrgPlan)}
                        className={cn('text-[11px] font-medium px-2 py-1 rounded-full border-0 cursor-pointer capitalize', PLAN_BADGE[org.plan])}
                      >
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-[var(--muted)]">
                        <Users size={13} />
                        {userCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {hasWA ? (
                        <span className="flex items-center gap-1 text-green-600 text-[12px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          {clinic!.whatsapp_number}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[var(--subtle)]">Sin configurar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{formatDate(org.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(org)}
                        disabled={togglingId === org.id}
                        className={cn(
                          'px-3 py-1 rounded-full text-[11px] font-medium transition-colors',
                          org.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        )}
                      >
                        {togglingId === org.id ? '...' : org.is_active ? '● Activo' : '○ Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/superadmin/users?orgId=${org.id}`}
                          className="flex items-center gap-1 px-2 py-1 rounded-[8px] text-[11px] text-[var(--brand)] border border-[var(--brand)] hover:bg-[var(--brand-subtle)] transition-colors"
                          title="Gestionar staff"
                        >
                          <UserCog size={11} /> Staff
                        </a>
                        <button
                          onClick={() => setShowDeleteConfirm(org.id)}
                          className="p-1.5 rounded-[8px] text-[var(--subtle)] hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Eliminar organización"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] w-full max-w-[400px] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Eliminar organización</h2>
                <p className="text-[12px] text-[var(--subtle)] mt-0.5">
                  Esto eliminará permanentemente la organización, sus clínicas, profesionales, turnos y usuarios. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)]"
              >Cancelar</button>
              <button
                onClick={() => handleDeleteOrg(showDeleteConfirm, orgs.find(o => o.id === showDeleteConfirm)?.name ?? '')}
                disabled={deletingId === showDeleteConfirm}
                className="px-4 py-2 rounded-[10px] bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId === showDeleteConfirm ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] w-full max-w-[480px] shadow-2xl">
            <div className="p-5 border-b border-[var(--border)]">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Nuevo cliente</h2>
              <p className="text-[12px] text-[var(--subtle)] mt-0.5">Se crea la organización, la clínica y el usuario administrador.</p>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]">
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input label="Nombre de la organización *" placeholder="Clínica del Norte" value={form.orgName} onChange={e => setField('orgName', e.target.value)} required />
                <Input label="Nombre de la clínica" placeholder="(igual a org si vacío)" value={form.clinicName} onChange={e => setField('clinicName', e.target.value)} />
              </div>

              <Input label="Nombre del administrador *" placeholder="Dr. Juan Pérez" value={form.ownerName} onChange={e => setField('ownerName', e.target.value)} required />
              <Input label="Email *" type="email" placeholder="admin@clinica.com" value={form.email} onChange={e => setField('email', e.target.value)} required />
              <Input label="Contraseña *" type="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={e => setField('password', e.target.value)} minLength={8} required hint="El cliente puede cambiarla desde su perfil." />

              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-medium text-[var(--foreground)]">Plan</label>
                <select
                  value={form.plan}
                  onChange={e => setField('plan', e.target.value)}
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--brand)] transition-colors"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError(null) }}
                  className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {saving ? 'Creando...' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
