'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Building2, Stethoscope, Plug, User, Shield,
  Save, Check, AlertCircle, Eye, EyeOff, Copy, Camera,
  FileKey, Upload, CheckCircle2,
} from 'lucide-react'
import { WhatsAppQR } from '@/components/settings/whatsapp-qr'
import { cn } from '@/lib/utils/cn'
import { useAuth, useRole } from '@/lib/hooks/use-auth'
import { usePlan } from '@/lib/plans/use-plan'
import { PlanLimitBlock } from '@/components/ui/plan-limit-banner'
import { RoleGuard } from '@/components/auth/role-guard'
import { createClient } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────
type Tab = 'organization' | 'clinic' | 'integrations' | 'afip' | 'account' | 'roles'

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'organization',  label: 'Organización',   icon: Building2 },
  { key: 'clinic',        label: 'Clínica',         icon: Stethoscope },
  { key: 'integrations',  label: 'Integraciones',   icon: Plug },
  { key: 'afip',          label: 'ARCA / AFIP',     icon: FileKey },
  { key: 'account',       label: 'Mi cuenta',       icon: User },
  { key: 'roles',         label: 'Roles y acceso',  icon: Shield },
]

// ── Sub-components ───────────────────────────────────────────
function SaveButton({ loading, saved }: { loading: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity"
    >
      {saved ? <Check size={14} /> : <Save size={14} />}
      {saved ? 'Guardado' : loading ? 'Guardando...' : 'Guardar cambios'}
    </button>
  )
}

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12.5px] font-medium text-[var(--foreground)]">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[var(--subtle)]">{hint}</p>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]',
        'text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors',
        props.disabled && 'opacity-50 cursor-not-allowed',
        props.className
      )}
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--brand)] transition-colors"
    >
      {children}
    </select>
  )
}

// ── Tabs ─────────────────────────────────────────────────────
function OrganizationTab() {
  const { authUser, updateOrgName } = useAuth()
  const [name, setName]   = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authUser?.organization) {
      setName(authUser.organization.name ?? '')
    }
  }, [authUser?.organization])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await fetch('/api/settings/organization', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? 'Error al guardar')
      setLoading(false)
      return
    }
    updateOrgName(name)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-[520px]">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Datos de la organización</h2>
        <p className="text-[12px] text-[var(--subtle)] mt-0.5">Información principal visible para todos los usuarios.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <FormField label="Nombre de la organización">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Clinify" required />
      </FormField>

      <SaveButton loading={loading} saved={saved} />
    </form>
  )
}

function ClinicTab() {
  const { currentClinic, updateCurrentClinic } = useAuth()
  const [name,      setName]      = useState(currentClinic?.name ?? '')
  const [address,   setAddress]   = useState(currentClinic?.address ?? '')
  const [phone,     setPhone]     = useState(currentClinic?.phone ?? '')
  const [whatsapp,  setWhatsapp]  = useState(currentClinic?.whatsapp_number ?? '')
  const [timezone,  setTimezone]  = useState(currentClinic?.timezone ?? 'America/Argentina/Cordoba')
  const [saved, setSaved]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentClinic?.id) return
    setLoading(true); setError(null)
    const res = await fetch('/api/settings/clinic', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId: currentClinic.id, name, address, phone, whatsapp_number: whatsapp, timezone }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? 'Error al guardar')
      setLoading(false)
      return
    }
    updateCurrentClinic({ name, address, phone: phone || null, whatsapp_number: whatsapp || null, timezone })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-[520px]">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Datos de la clínica</h2>
        <p className="text-[12px] text-[var(--subtle)] mt-0.5">Información y configuración de tu clínica.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <FormField label="Nombre de la clínica">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mi Clínica" required />
      </FormField>

      <FormField label="Dirección">
        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Av. Colón 1234, Córdoba" />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Teléfono">
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 351 4400000" />
        </FormField>
        <FormField label="WhatsApp (número de bot)">
          <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+5493514400000" />
        </FormField>
      </div>

      <FormField label="Zona horaria">
        <Select value={timezone} onChange={e => setTimezone(e.target.value)}>
          <option value="America/Argentina/Cordoba">Argentina (Córdoba) — GMT-3</option>
          <option value="America/Argentina/Buenos_Aires">Argentina (Buenos Aires) — GMT-3</option>
          <option value="America/Argentina/Mendoza">Argentina (Mendoza) — GMT-3</option>
          <option value="America/Santiago">Chile (Santiago) — GMT-4</option>
          <option value="America/Bogota">Colombia (Bogotá) — GMT-5</option>
          <option value="America/Lima">Perú (Lima) — GMT-5</option>
          <option value="America/Mexico_City">México (CDMX) — GMT-6</option>
        </Select>
      </FormField>

      <SaveButton loading={loading} saved={saved} />
    </form>
  )
}

function SecretField({ value, label }: { value: string; label: string }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <FormField label={label}>
      <div className="flex gap-1">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          readOnly
          className="flex-1 font-mono text-[11px]"
        />
        <button type="button" onClick={() => setShow(!show)} className="px-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] text-[var(--subtle)] hover:text-[var(--muted)] transition-colors">
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button type="button" onClick={copy} className="px-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] text-[var(--subtle)] hover:text-[var(--brand)] transition-colors">
          {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
        </button>
      </div>
    </FormField>
  )
}

function IntegrationsTab() {
  const [evolutionUrl, setEvolutionUrl] = useState(process.env.NEXT_PUBLIC_EVOLUTION_URL ?? 'http://localhost:8080')
  const [evolutionKey, setEvolutionKey] = useState('••••••••••••••••')
  const [n8nUrl, setN8nUrl] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-[560px]">
      {/* Evolution API */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] bg-green-100 flex items-center justify-center">
            <span className="text-[14px]">📱</span>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Evolution API — WhatsApp</h3>
            <p className="text-[11px] text-[var(--subtle)]">Servidor que conecta el bot con WhatsApp</p>
          </div>
        </div>

        {/* QR / connection manager */}
        <div className="p-4 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
          <p className="text-[12px] font-semibold text-[var(--foreground)] mb-3">Estado de conexión</p>
          <WhatsAppQR />
        </div>

        <FormField label="URL del servidor">
          <Input value={evolutionUrl} onChange={e => setEvolutionUrl(e.target.value)} placeholder="http://localhost:8080" />
        </FormField>
        <FormField label="API Key">
          <Input value={evolutionKey} onChange={e => setEvolutionKey(e.target.value)} type="password" placeholder="tu-api-key" />
        </FormField>
        <SecretField label="Webhook URL (configurar en Evolution)" value={`${typeof window !== 'undefined' ? window.location.origin : 'https://tu-app.vercel.app'}/api/webhooks/whatsapp`} />
      </div>

      <div className="border-t border-[var(--border)]" />

      {/* n8n */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] bg-orange-100 flex items-center justify-center">
            <span className="text-[14px]">⚙️</span>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">n8n — Automatizaciones</h3>
            <p className="text-[11px] text-[var(--subtle)]">15 workflows de automatización</p>
          </div>
          <span className={cn('ml-auto badge text-[10px]', n8nUrl ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
            {n8nUrl ? '● Conectado' : '○ Sin configurar'}
          </span>
        </div>
        <FormField label="URL base de n8n" hint="Ej: https://n8n.tu-dominio.com/webhook">
          <Input value={n8nUrl} onChange={e => setN8nUrl(e.target.value)} placeholder="https://n8n.tu-dominio.com/webhook" />
        </FormField>
      </div>

      <div className="border-t border-[var(--border)]" />

      {/* Supabase info */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] bg-teal-100 flex items-center justify-center">
            <span className="text-[14px]">🗄</span>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Supabase — Base de datos</h3>
            <p className="text-[11px] text-[var(--subtle)]">PostgreSQL + Auth + Storage + RLS</p>
          </div>
          <span className="ml-auto badge bg-teal-100 text-teal-700 text-[10px]">● Conectado</span>
        </div>
        <div className="p-3 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]">
          <p className="text-[12px] text-[var(--muted)]">URL: <span className="font-mono text-[11px]">{process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(no configurado)'}</span></p>
        </div>
      </div>

      <SaveButton loading={false} saved={saved} />
    </form>
  )
}

function AccountTab() {
  const { authUser, signOut, updateAvatarUrl } = useAuth()
  const [fullName, setFullName] = useState(authUser?.profile?.full_name ?? '')
  const [newPw,    setNewPw]    = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saved, setSaved]       = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState(authUser?.profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !authUser?.profile?.id) return
    if (file.size > 2 * 1024 * 1024) { setAvatarError('La imagen no puede superar los 2 MB'); return }

    setUploading(true); setAvatarError(null)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `avatars/${authUser.profile.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) { setAvatarError(uploadError.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const urlWithBust = `${publicUrl}?t=${Date.now()}`

    await supabase.from('profiles').update({ avatar_url: urlWithBust }).eq('id', authUser.profile.id)
    setAvatarUrl(urlWithBust)
    updateAvatarUrl(urlWithBust)
    setUploading(false)
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    if (authUser?.profile?.id) {
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', authUser.profile.id)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setLoading(false)
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setError('Las contraseñas no coinciden'); return }
    if (newPw.length < 8) { setError('Mínimo 8 caracteres'); return }
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) { setError(error.message) } else { setNewPw(''); setConfirmPw(''); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setLoading(false)
  }

  const initials = fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <div className="space-y-6 max-w-[520px]">
      <form onSubmit={handleProfile} className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Perfil</h2>
          <p className="text-[12px] text-[var(--subtle)] mt-0.5">Tu información personal en la plataforma.</p>
        </div>

        {/* Avatar upload */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#6366f1] to-[#818cf8] flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-[18px] font-bold">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shadow-md hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <Camera size={12} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--foreground)]">Foto de perfil</p>
            <p className="text-[11px] text-[var(--subtle)] mt-0.5">JPG, PNG o WebP · máx. 2 MB</p>
            {uploading && <p className="text-[11px] text-[var(--brand)] mt-1">Subiendo...</p>}
            {avatarError && <p className="text-[11px] text-red-600 mt-1">{avatarError}</p>}
          </div>
        </div>

        <FormField label="Nombre completo">
          <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Tu nombre" />
        </FormField>

        <FormField label="Email">
          <Input value={authUser?.user?.email ?? ''} disabled placeholder="email@ejemplo.com" />
        </FormField>

        <FormField label="Rol">
          <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]">
            <span className="badge bg-indigo-100 text-indigo-700 text-[11px] capitalize">
              {authUser?.role ?? 'demo'}
            </span>
            <span className="text-[12px] text-[var(--muted)]">Los roles son asignados por el administrador</span>
          </div>
        </FormField>

        <SaveButton loading={loading} saved={saved} />
      </form>

      <div className="border-t border-[var(--border)]" />

      <form onSubmit={handlePassword} className="space-y-4">
        <h3 className="text-[14px] font-semibold text-[var(--foreground)]">Cambiar contraseña</h3>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <FormField label="Nueva contraseña">
          <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} required />
        </FormField>
        <FormField label="Confirmar contraseña">
          <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repetir contraseña" required />
        </FormField>

        <SaveButton loading={loading} saved={saved} />
      </form>

      <div className="border-t border-[var(--border)]" />

      <div>
        <h3 className="text-[14px] font-semibold text-red-600 mb-2">Zona de peligro</h3>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-red-200 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

const ROLES_INFO = [
  { role: 'owner',  label: 'Owner',   color: 'bg-purple-100 text-purple-700', desc: 'Acceso total · Puede eliminar la organización' },
  { role: 'admin',  label: 'Admin',   color: 'bg-indigo-100 text-indigo-700', desc: 'Gestión completa · No puede eliminar la org' },
  { role: 'staff',  label: 'Staff',   color: 'bg-blue-100 text-blue-700',     desc: 'Turnos, pacientes, mensajes · No settings' },
  { role: 'viewer', label: 'Viewer',  color: 'bg-gray-100 text-gray-600',     desc: 'Solo lectura' },
]

function RolesTab() {
  return (
    <div className="space-y-5 max-w-[560px]">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Roles y permisos</h2>
        <p className="text-[12px] text-[var(--subtle)] mt-0.5">La asignación de roles se gestiona desde Supabase Authentication.</p>
      </div>

      <div className="space-y-2">
        {ROLES_INFO.map(r => (
          <div key={r.role} className="flex items-center gap-3 p-3.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
            <span className={cn('badge text-[11px] w-16 justify-center', r.color)}>{r.label}</span>
            <p className="text-[12.5px] text-[var(--muted)] flex-1">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-[12px] bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12.5px] font-medium text-amber-800">Gestión de usuarios</p>
            <p className="text-[12px] text-amber-700 mt-0.5">Para invitar usuarios o cambiar roles, usá el panel de <strong>Supabase Authentication</strong> y actualizá el campo <code className="font-mono text-[11px]">role</code> en la tabla <code className="font-mono text-[11px]">profiles</code>.</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[13px] font-semibold text-[var(--foreground)] mb-3">Matriz de permisos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left pb-2 text-[var(--muted)] font-medium">Módulo</th>
                {ROLES_INFO.map(r => <th key={r.role} className="pb-2 text-center text-[var(--muted)] font-medium">{r.label}</th>)}
              </tr>
            </thead>
            <tbody className="space-y-1">
              {[
                ['Turnos',          '✅','✅','✅','👁'],
                ['Pacientes',       '✅','✅','✅','👁'],
                ['Profesionales',   '✅','✅','👁','👁'],
                ['WhatsApp Bot',    '✅','✅','✅','👁'],
                ['Analytics',       '✅','✅','👁','👁'],
                ['Settings',        '✅','✅','❌','❌'],
                ['Organización',    '✅','❌','❌','❌'],
              ].map(([mod, ...perms]) => (
                <tr key={mod as string} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 text-[var(--foreground)] font-medium">{mod as string}</td>
                  {perms.map((p, i) => <td key={i} className="py-2 text-center">{p as string}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── AFIP / ARCA ──────────────────────────────────────────────
const TUTORIAL_STEPS = [
  {
    num: '1',
    title: 'Ingresá a ARCA con clave fiscal',
    desc: 'Entrá a arca.gob.ar con tu CUIT y clave fiscal nivel 3 o superior.',
    detail: 'Si no tenés clave fiscal nivel 3, pedila en cualquier dependencia de ARCA con tu DNI.',
    color: 'bg-indigo-500',
  },
  {
    num: '2',
    title: 'Habilitá el servicio "Factura Electrónica"',
    desc: 'En "Administrador de relaciones de clave fiscal" → Adherir servicio → buscá "Factura Electrónica".',
    detail: 'Si ya lo tenés habilitado, pasá al paso siguiente.',
    color: 'bg-violet-500',
  },
  {
    num: '3',
    title: 'Generá el certificado digital',
    desc: 'Menú → Administración de Certificados Digitales → Agregar → completá los datos.',
    detail: 'Vas a descargar un archivo .p12. Guardá muy bien la contraseña que ponés — la vas a necesitar acá.',
    color: 'bg-blue-500',
  },
  {
    num: '4',
    title: 'Vinculá el certificado al servicio wsfe',
    desc: 'En la misma pantalla de certificados → seleccioná el que acabás de crear → Vincular → elegí "wsfe" (Facturación Electrónica v1).',
    detail: 'Sin este paso ARCA rechazará todas las solicitudes de CAE.',
    color: 'bg-cyan-500',
  },
  {
    num: '5',
    title: 'Habilitá tu punto de venta',
    desc: 'Factura Electrónica → ABM de puntos de venta → Agregar → tipo "Web Services".',
    detail: 'Anotá el número (normalmente 1 o 2). Ese número va en el campo "Punto de venta" de abajo.',
    color: 'bg-teal-500',
  },
  {
    num: '6',
    title: 'Cargá el certificado acá y probá',
    desc: 'Subí el .p12, ingresá tu CUIT y la contraseña. Dejá el modo homologación activado para hacer pruebas.',
    detail: 'En homologación podés emitir facturas de prueba sin efectos reales. Cuando todo funcione, desactivá el modo y listo.',
    color: 'bg-green-500',
  },
]

function TutorialStep({ step, isLast }: { step: typeof TUTORIAL_STEPS[0]; isLast: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-6 h-6 rounded-full ${step.color} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white text-[10px] font-bold">{step.num}</span>
        </div>
        {!isLast && <div className="w-px flex-1 bg-[var(--border)] mt-1 mb-1 min-h-[16px]" />}
      </div>
      <div className={cn('pb-4 flex-1', isLast && 'pb-0')}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full text-left"
        >
          <p className="text-[13px] font-semibold text-[var(--foreground)] leading-tight">{step.title}</p>
          <p className="text-[11.5px] text-[var(--muted)] mt-0.5 leading-relaxed">{step.desc}</p>
        </button>
        {open && (
          <div className="mt-2 p-2.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)]">
            <p className="text-[11.5px] text-[var(--subtle)] leading-relaxed">{step.detail}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AfipTab() {
  const [cuit,       setCuit]       = useState('')
  const [puntoVenta, setPuntoVenta] = useState('1')
  const [passphrase, setPassphrase] = useState('')
  const [sandbox,    setSandbox]    = useState(true)
  const [showTutorial, setShowTutorial] = useState(false)
  const [certName,   setCertName]   = useState<string | null>(null)
  const [certB64,    setCertB64]    = useState<string | null>(null)
  const [hasCert,    setHasCert]    = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/afip/credentials')
      .then(r => r.json())
      .then(d => {
        if (!d) return
        setCuit(d.cuit ?? '')
        setPuntoVenta(String(d.punto_venta ?? 1))
        setSandbox(d.sandbox ?? true)
        setHasCert(d.has_certificate ?? false)
      })
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCertName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1]
      setCertB64(b64)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await fetch('/api/afip/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cuit,
        punto_venta: parseInt(puntoVenta),
        sandbox,
        ...(certB64    && { certificate_base64: certB64 }),
        ...(passphrase && { passphrase }),
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    setHasCert(data.has_certificate ?? hasCert)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-[540px]">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Facturación electrónica ARCA</h2>
        <p className="text-[12px] text-[var(--subtle)] mt-0.5">
          Configurá el certificado digital para emitir facturas con CAE.
        </p>
      </div>

      {/* Tutorial */}
      <div className="rounded-[12px] border border-[var(--border)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTutorial(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-2)] hover:bg-[var(--border)] transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-[14px]">📋</span>
            <span className="text-[13px] font-semibold text-[var(--foreground)]">¿Cómo activarlo paso a paso?</span>
            <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">6 pasos · ~15 min</span>
          </div>
          <span className="text-[var(--subtle)] text-[11px]">{showTutorial ? '▲ Ocultar' : '▼ Ver tutorial'}</span>
        </button>

        {showTutorial && (
          <div className="px-4 pt-4 pb-2 space-y-0 border-t border-[var(--border)]">
            {TUTORIAL_STEPS.map((step, i) => (
              <TutorialStep key={step.num} step={step} isLast={i === TUTORIAL_STEPS.length - 1} />
            ))}

            <div className="mt-3 mb-4 p-3 rounded-[10px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex gap-2">
              <span className="text-[13px] flex-shrink-0">⚠️</span>
              <div className="text-[11.5px] text-amber-800 dark:text-amber-300 space-y-1">
                <p><strong>Monotributistas:</strong> usá Factura C (FC-C). No llevás IVA discriminado.</p>
                <p><strong>Responsables inscriptos:</strong> usá Factura A (FC-A) para clientes con CUIT, y Factura B (FC-B) para consumidores finales.</p>
                <p><strong>Punto de venta:</strong> tiene que ser de tipo <strong>"Web Services"</strong> en ARCA, no "Local".</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sandbox toggle */}
      <div className="flex items-center justify-between p-3 rounded-[12px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <div>
          <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">Modo homologación (pruebas)</p>
          <p className="text-[11px] text-amber-600 dark:text-amber-500">Desactivá cuando estés listo para producción</p>
        </div>
        <button
          type="button"
          onClick={() => setSandbox(s => !s)}
          className={cn(
            'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
            sandbox ? 'bg-amber-400' : 'bg-[var(--brand)]'
          )}
        >
          <span className={cn(
            'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
            sandbox ? 'left-0.5' : 'left-5'
          )} />
        </button>
      </div>

      <FormField label="CUIT (sin guiones)" hint="Ej: 20123456789">
        <Input
          value={cuit}
          onChange={e => setCuit(e.target.value.replace(/\D/g, ''))}
          placeholder="20123456789"
          maxLength={11}
          required
        />
      </FormField>

      <FormField label="Punto de venta" hint="Número de punto de venta habilitado en ARCA (usualmente 1)">
        <Input
          type="number"
          value={puntoVenta}
          onChange={e => setPuntoVenta(e.target.value)}
          min={1}
          max={9999}
          required
        />
      </FormField>

      {/* Certificado */}
      <div className="space-y-2">
        <label className="block text-[12.5px] font-medium text-[var(--foreground)]">
          Certificado digital (.p12)
        </label>
        {hasCert && !certB64 && (
          <div className="flex items-center gap-2 p-2.5 rounded-[10px] bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
            <span className="text-[12px] text-green-700 dark:text-green-400">Certificado cargado — subí uno nuevo para reemplazarlo</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] border border-dashed border-[var(--border)] hover:border-[var(--brand)] hover:bg-[var(--brand-subtle)] transition-colors text-[12.5px] text-[var(--muted)] w-full"
        >
          <Upload size={14} />
          {certName ?? 'Seleccionar archivo .p12'}
        </button>
        <input ref={fileRef} type="file" accept=".p12,.pfx" className="hidden" onChange={handleFile} />
        <p className="text-[11px] text-[var(--subtle)]">
          Generá el certificado en <strong>ARCA → Administración de Certificados Digitales</strong>
        </p>
      </div>

      <FormField label="Contraseña del certificado" hint="La contraseña que pusiste al generar el .p12">
        <Input
          type="password"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          placeholder={hasCert ? '(sin cambios)' : 'Contraseña del certificado'}
        />
      </FormField>

      {/* Info */}
      <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
        <div className="flex items-center gap-2">
          <FileKey size={13} className="text-[var(--brand)]" />
          <span className="text-[12px] font-medium text-[var(--foreground)]">¿Cómo obtengo el certificado?</span>
        </div>
        <ol className="text-[11.5px] text-[var(--muted)] space-y-0.5 pl-4 list-decimal">
          <li>Ingresá a <strong>arca.gob.ar</strong> con CUIT y clave fiscal</li>
          <li>Buscá <strong>Administración de Certificados Digitales</strong></li>
          <li>Generá un nuevo certificado para el servicio <strong>wsfe</strong></li>
          <li>Descargá el archivo <strong>.p12</strong> y guardá la contraseña</li>
          <li>Subilo acá y listo</li>
        </ol>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-200 text-red-700 text-[12px]">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <SaveButton loading={loading} saved={saved} />
    </form>
  )
}

// ── Main ─────────────────────────────────────────────────────
export function SettingsContent() {
  const [tab, setTab] = useState<Tab>('organization')
  const { isAdmin } = useRole()
  const { loading } = useAuth()
  const { hasAfip, upgradeLabel } = usePlan()

  const TAB_CONTENT: Record<Tab, React.ReactNode> = {
    organization: <OrganizationTab />,
    clinic:       <ClinicTab />,
    integrations: <IntegrationsTab />,
    afip:         hasAfip ? <AfipTab /> : <PlanLimitBlock feature="Facturación AFIP / ARCA" upgradeLabel={upgradeLabel} />,
    account:      <AccountTab />,
    roles:        <RolesTab />,
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Configuración</h1>
        <p className="text-[13px] text-[var(--subtle)] mt-0.5">Organización · Clínica · Integraciones · Mi cuenta</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-[180px] flex-shrink-0">
          <nav className="space-y-0.5">
            {TABS.map(t => {
              const Icon = t.icon
              const disabled = !loading && !isAdmin && t.key === 'organization'
              return (
                <button
                  key={t.key}
                  onClick={() => !disabled && setTab(t.key)}
                  disabled={disabled}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] font-medium text-left transition-colors',
                    tab === t.key
                      ? 'bg-[var(--brand-subtle)] text-[var(--brand)]'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]',
                    disabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="flex-1 card p-6"
        >
          {TAB_CONTENT[tab]}
        </motion.div>
      </div>
    </div>
  )
}
