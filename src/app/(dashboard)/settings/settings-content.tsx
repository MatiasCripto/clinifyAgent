'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Building2, Stethoscope, Plug, User, Shield, Calendar,
  Save, Check, AlertCircle, Eye, EyeOff, Copy, Camera,
  Upload, CheckCircle2, Brain,
} from 'lucide-react'
import { WhatsAppQR } from '@/components/settings/whatsapp-qr'
import { AgendaTab } from '@/components/settings/agenda-tab'
import { cn } from '@/lib/utils/cn'
import { useAuth, useRole } from '@/lib/hooks/use-auth'
import { RoleGuard } from '@/components/auth/role-guard'
import { createClient } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────
type Tab = 'organization' | 'clinic' | 'integrations' | 'account' | 'roles' | 'agenda'

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'organization',  label: 'Organización',   icon: Building2 },
  { key: 'clinic',        label: 'Clínica',         icon: Stethoscope },
  { key: 'agenda',        label: 'Agenda',          icon: Calendar },
  { key: 'integrations',  label: 'Integraciones',   icon: Plug },
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

  // AI config
  const [aiProvider, setAiProvider] = useState('openai')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('gpt-4o')
  const [aiConfigured, setAiConfigured] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaved, setAiSaved] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/ai-config')
      .then(r => r.json())
      .then(data => {
        if (data?.provider) {
          setAiProvider(data.provider)
          setAiModel(data.model || 'gpt-4o')
          setAiConfigured(true)
        }
      })
  }, [])

  async function saveAiConfig() {
    if (!aiApiKey && !aiConfigured) return
    setAiLoading(true); setAiError(null)
    const body: Record<string, string> = { provider: aiProvider, model: aiModel }
    if (aiApiKey) body.apiKey = aiApiKey // solo envía la key si el usuario puso una nueva
    const res = await fetch('/api/settings/ai-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json()
      setAiError(d.error ?? 'Error al guardar')
      setAiLoading(false)
      return
    }
    setAiConfigured(true)
    setAiApiKey('')
    setAiSaved(true)
    setTimeout(() => setAiSaved(false), 2000)
    setAiLoading(false)
  }

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

      {/* AI — Bot Conversacional */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] bg-purple-100 flex items-center justify-center">
            <Brain size={14} className="text-purple-600" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">IA — Bot conversacional</h3>
            <p className="text-[11px] text-[var(--subtle)]">API key para que el bot de WhatsApp responda con lenguaje natural</p>
          </div>
          <span className={cn('ml-auto badge text-[10px]', aiConfigured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
            {aiConfigured ? '● Configurado' : '○ Sin configurar'}
          </span>
        </div>

        <FormField label="Proveedor de IA">
          <Select value={aiProvider} onChange={e => setAiProvider(e.target.value)}>
            <option value="openai">OpenAI (GPT-4o, GPT-4)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="groq">Groq (Llama, Mixtral)</option>
            <option value="google">Google (Gemini)</option>
            <option value="deepseek">DeepSeek</option>
          </Select>
        </FormField>

        <FormField label="Modelo" hint="Ej: gpt-4o, claude-opus-4, gemini-2.0-flash">
          <Input
            value={aiModel}
            onChange={e => setAiModel(e.target.value)}
            placeholder="gpt-4o"
          />
        </FormField>

        <FormField label="API Key" hint={aiConfigured ? 'La API key ya está guardada. Pegá una nueva para reemplazarla.' : 'Pegá la API key de tu proveedor de IA'}>
          <div className="flex gap-2">
            <Input
              type="password"
              value={aiApiKey}
              onChange={e => setAiApiKey(e.target.value)}
              placeholder={aiConfigured ? '•••••••••••••••• (dejá vacío para mantener la actual)' : 'sk-...'}
              className="flex-1"
            />
            <button
              type="button"
              onClick={saveAiConfig}
              disabled={aiLoading || (!aiApiKey && !aiConfigured)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[12px] font-semibold disabled:opacity-60 hover:opacity-90"
            >
              {aiSaved ? <Check size={13} /> : aiLoading ? '...' : 'Guardar'}
            </button>
          </div>
        </FormField>

        {aiError && (
          <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]">
            <AlertCircle size={13} /> {aiError}
          </div>
        )}
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

// ── Main ─────────────────────────────────────────────────────
export function SettingsContent() {
  const { isAdmin, isOwner, isStaff } = useRole()
  const { loading } = useAuth()

  // Staff only sees Agenda and Mi cuenta; Roles tab only for owners
  const visibleTabs = isAdmin
    ? TABS.filter(t => t.key !== 'roles' || isOwner)
    : TABS.filter(t => t.key === 'agenda' || t.key === 'account')

  const [tab, setTab] = useState<Tab>(isAdmin ? 'organization' : 'agenda')

  const TAB_CONTENT: Record<Tab, React.ReactNode> = {
    organization: <OrganizationTab />,
    clinic:       <ClinicTab />,
    agenda:       <AgendaTab />,
    integrations: <IntegrationsTab />,
    account:      <AccountTab />,
    roles:        <RolesTab />,
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Configuración</h1>
        <p className="text-[13px] text-[var(--subtle)] mt-0.5">
          {isAdmin ? 'Organización · Clínica · Integraciones · Mi cuenta' : 'Agenda · Mi cuenta'}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-[180px] flex-shrink-0">
          <nav className="space-y-0.5">
            {visibleTabs.map(t => {
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
