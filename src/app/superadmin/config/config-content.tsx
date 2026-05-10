'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { Plus, Trash2, Settings2, Flag, Key, Sliders, AlertCircle, Eye, EyeOff, RefreshCw, Pencil } from 'lucide-react'

interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string | null
  enabled: boolean
  created_at: string
}

interface ApiKey {
  id: string
  service: string
  label: string
  masked_value: string
  last_used_at: string | null
  created_at: string
}

interface PlatformSetting {
  id: string
  key: string
  value: string
  description: string | null
}

type Tab = 'settings' | 'flags' | 'keys'

function SAInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[12px] font-medium text-white/60">{label}</label>}
      <input {...props} className="w-full px-3 py-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
    </div>
  )
}

function SATextarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[12px] font-medium text-white/60">{label}</label>}
      <textarea {...props} rows={2} className="w-full px-3 py-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none" />
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('relative w-9 h-5 rounded-full transition-colors', checked ? 'bg-violet-500' : 'bg-white/[0.10]')}
    >
      <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}

export function ConfigContent() {
  const [tab, setTab] = useState<Tab>('settings')
  const [flags, setFlags]       = useState<FeatureFlag[]>([])
  const [keys, setKeys]         = useState<ApiKey[]>([])
  const [settings, setSettings] = useState<PlatformSetting[]>([])
  const [loading, setLoading]   = useState(true)

  // Flag modal
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [editingFlag, setEditingFlag]     = useState<FeatureFlag | null>(null)
  const [flagForm, setFlagForm]           = useState({ key: '', name: '', description: '', enabled: false })

  // Key modal
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [editingKey, setEditingKey]     = useState<ApiKey | null>(null)
  const [keyForm, setKeyForm]           = useState({ service: '', label: '', value: '' })
  const [showKeyValue, setShowKeyValue] = useState(false)

  // Setting modal
  const [showSettingModal, setShowSettingModal] = useState(false)
  const [settingForm, setSettingForm]           = useState({ key: '', value: '', description: '' })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/superadmin/config')
    if (res.ok) {
      const json = await res.json()
      setFlags(json.flags ?? [])
      setKeys(json.keys ?? [])
      setSettings(json.settings ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Feature flags
  async function saveFlag(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)
    const res = await fetch('/api/superadmin/config', {
      method: editingFlag ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingFlag
        ? { type: 'flag', id: editingFlag.id, ...flagForm }
        : { type: 'flag', ...flagForm }
      ),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error'); setSaving(false); return }
    setShowFlagModal(false)
    await load()
    setSaving(false)
  }

  async function toggleFlag(flag: FeatureFlag) {
    await fetch('/api/superadmin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'flag', id: flag.id, enabled: !flag.enabled }),
    })
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: !f.enabled } : f))
  }

  async function deleteFlag(id: string) {
    if (!confirm('¿Eliminar este flag?')) return
    await fetch(`/api/superadmin/config?type=flag&id=${id}`, { method: 'DELETE' })
    setFlags(prev => prev.filter(f => f.id !== id))
  }

  // API Keys
  async function saveKey(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)
    const res = await fetch('/api/superadmin/config', {
      method: editingKey ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingKey
        ? { type: 'key', id: editingKey.id, service: keyForm.service, label: keyForm.label, ...(keyForm.value ? { value: keyForm.value } : {}) }
        : { type: 'key', ...keyForm }
      ),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error'); setSaving(false); return }
    setShowKeyModal(false)
    await load()
    setSaving(false)
  }

  async function deleteKey(id: string) {
    if (!confirm('¿Eliminar esta API key?')) return
    await fetch(`/api/superadmin/config?type=key&id=${id}`, { method: 'DELETE' })
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  // Settings
  async function saveSetting(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)
    const res = await fetch('/api/superadmin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'setting', ...settingForm }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error'); setSaving(false); return }
    setShowSettingModal(false)
    await load()
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-bold text-white/90">Configuración</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Ajustes globales, feature flags y API keys del sistema</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {([
          { id: 'settings', label: 'Ajustes generales', icon: Sliders },
          { id: 'flags',    label: 'Feature Flags',     icon: Flag },
          { id: 'keys',     label: 'API Keys',           icon: Key },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 text-[12.5px] font-medium border-b-2 transition-colors',
              tab === id ? 'border-violet-500 text-violet-300' : 'border-transparent text-white/40 hover:text-white/70'
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Settings tab */}
          {tab === 'settings' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => { setSettingForm({ key: '', value: '', description: '' }); setError(null); setShowSettingModal(true) }} className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-500 transition-colors">
                  <Plus size={13} /> Agregar ajuste
                </button>
              </div>
              <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] overflow-hidden">
                {settings.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[12px] text-white/30">Sin ajustes configurados aún.</p>
                ) : (
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Clave</th>
                        <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Valor</th>
                        <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settings.map(s => (
                        <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-mono text-[11.5px] text-violet-300">{s.key}</td>
                          <td className="px-4 py-3 text-white/70">{s.value}</td>
                          <td className="px-4 py-3 text-white/30 text-[11.5px]">{s.description ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Feature flags tab */}
          {tab === 'flags' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => { setEditingFlag(null); setFlagForm({ key: '', name: '', description: '', enabled: false }); setError(null); setShowFlagModal(true) }} className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-500 transition-colors">
                  <Plus size={13} /> Nuevo flag
                </button>
              </div>
              <div className="space-y-2">
                {flags.length === 0 ? (
                  <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-8 text-center">
                    <Flag size={22} className="text-white/10 mx-auto mb-2" />
                    <p className="text-[12px] text-white/30">Sin feature flags. Creá el primero.</p>
                  </div>
                ) : flags.map(flag => (
                  <div key={flag.id} className="rounded-[12px] bg-[#15151f] border border-white/[0.06] px-4 py-3 flex items-center gap-4 hover:border-white/[0.10] transition-colors">
                    <Toggle checked={flag.enabled} onChange={() => toggleFlag(flag)} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-white/80">{flag.name}</span>
                        <span className="font-mono text-[10.5px] text-violet-400/70 bg-violet-500/10 px-1.5 py-0.5 rounded">{flag.key}</span>
                        <span className={cn('text-[10px] font-medium', flag.enabled ? 'text-green-400' : 'text-white/25')}>
                          {flag.enabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      {flag.description && <p className="text-[11.5px] text-white/30 mt-0.5">{flag.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingFlag(flag); setFlagForm({ key: flag.key, name: flag.name, description: flag.description ?? '', enabled: flag.enabled }); setError(null); setShowFlagModal(true) }} className="p-1.5 rounded-[6px] text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => deleteFlag(flag.id)} className="p-1.5 rounded-[6px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* API Keys tab */}
          {tab === 'keys' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-white/30">Las claves se almacenan enmascaradas. Solo se muestra el valor al ingresar uno nuevo.</p>
                <button onClick={() => { setEditingKey(null); setKeyForm({ service: '', label: '', value: '' }); setShowKeyValue(false); setError(null); setShowKeyModal(true) }} className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-500 transition-colors">
                  <Plus size={13} /> Nueva API Key
                </button>
              </div>
              <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] overflow-hidden">
                {keys.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[12px] text-white/30">Sin API keys configuradas.</p>
                ) : (
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Servicio</th>
                        <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Label</th>
                        <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Valor</th>
                        <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Último uso</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map(k => (
                        <tr key={k.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="px-4 py-3">
                            <span className="font-medium text-white/70 capitalize">{k.service}</span>
                          </td>
                          <td className="px-4 py-3 text-white/50">{k.label}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-amber-300/70">{k.masked_value}</td>
                          <td className="px-4 py-3 text-white/30 text-[11.5px]">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('es-AR') : 'Nunca'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => { setEditingKey(k); setKeyForm({ service: k.service, label: k.label, value: '' }); setShowKeyValue(false); setError(null); setShowKeyModal(true) }} className="p-1.5 rounded-[6px] text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition-colors"><Pencil size={12} /></button>
                              <button onClick={() => deleteKey(k.id)} className="p-1.5 rounded-[6px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Feature Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#15151f] rounded-[14px] border border-white/[0.08] w-full max-w-[420px] shadow-2xl">
            <div className="flex items-center gap-3 p-5 border-b border-white/[0.06]">
              <Flag size={15} className="text-violet-400" />
              <h2 className="text-[14px] font-semibold text-white/80">{editingFlag ? 'Editar flag' : 'Nuevo feature flag'}</h2>
            </div>
            <form onSubmit={saveFlag} className="p-5 space-y-4">
              {error && <div className="flex items-center gap-2 p-3 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-300 text-[12px]"><AlertCircle size={13} /> {error}</div>}
              <SAInput label="Clave (key) *" placeholder="feature_new_ai" value={flagForm.key} onChange={e => setFlagForm(p => ({ ...p, key: e.target.value }))} required />
              <SAInput label="Nombre *" placeholder="Nueva IA" value={flagForm.name} onChange={e => setFlagForm(p => ({ ...p, name: e.target.value }))} required />
              <SATextarea label="Descripción" placeholder="Qué hace este flag..." value={flagForm.description} onChange={e => setFlagForm(p => ({ ...p, description: e.target.value }))} />
              <div className="flex items-center gap-3">
                <Toggle checked={flagForm.enabled} onChange={v => setFlagForm(p => ({ ...p, enabled: v }))} />
                <span className="text-[12.5px] text-white/60">{flagForm.enabled ? 'Habilitado' : 'Deshabilitado'}</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowFlagModal(false)} className="px-4 py-2 rounded-[8px] border border-white/[0.08] text-[12.5px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-[8px] bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-500 transition-colors disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#15151f] rounded-[14px] border border-white/[0.08] w-full max-w-[420px] shadow-2xl">
            <div className="flex items-center gap-3 p-5 border-b border-white/[0.06]">
              <Key size={15} className="text-amber-400" />
              <h2 className="text-[14px] font-semibold text-white/80">{editingKey ? 'Editar API Key' : 'Nueva API Key'}</h2>
            </div>
            <form onSubmit={saveKey} className="p-5 space-y-4">
              {error && <div className="flex items-center gap-2 p-3 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-300 text-[12px]"><AlertCircle size={13} /> {error}</div>}
              <SAInput label="Servicio *" placeholder="openai / whatsapp / stripe" value={keyForm.service} onChange={e => setKeyForm(p => ({ ...p, service: e.target.value }))} required />
              <SAInput label="Label *" placeholder="OpenAI Production Key" value={keyForm.label} onChange={e => setKeyForm(p => ({ ...p, label: e.target.value }))} required />
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-white/60">{editingKey ? 'Nueva clave (dejar vacío para no cambiar)' : 'Clave *'}</label>
                <div className="relative">
                  <input
                    type={showKeyValue ? 'text' : 'password'}
                    placeholder={editingKey ? '(sin cambios)' : 'sk-...'}
                    value={keyForm.value}
                    onChange={e => setKeyForm(p => ({ ...p, value: e.target.value }))}
                    required={!editingKey}
                    className="w-full px-3 py-2 pr-9 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                  <button type="button" onClick={() => setShowKeyValue(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showKeyValue ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowKeyModal(false)} className="px-4 py-2 rounded-[8px] border border-white/[0.08] text-[12.5px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-[8px] bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-500 transition-colors disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Setting Modal */}
      {showSettingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#15151f] rounded-[14px] border border-white/[0.08] w-full max-w-[420px] shadow-2xl">
            <div className="flex items-center gap-3 p-5 border-b border-white/[0.06]">
              <Settings2 size={15} className="text-violet-400" />
              <h2 className="text-[14px] font-semibold text-white/80">Agregar ajuste</h2>
            </div>
            <form onSubmit={saveSetting} className="p-5 space-y-4">
              {error && <div className="flex items-center gap-2 p-3 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-300 text-[12px]"><AlertCircle size={13} /> {error}</div>}
              <SAInput label="Clave *" placeholder="platform_name" value={settingForm.key} onChange={e => setSettingForm(p => ({ ...p, key: e.target.value }))} required />
              <SAInput label="Valor *" placeholder="Clinify" value={settingForm.value} onChange={e => setSettingForm(p => ({ ...p, value: e.target.value }))} required />
              <SATextarea label="Descripción" placeholder="Para qué sirve este ajuste..." value={settingForm.description} onChange={e => setSettingForm(p => ({ ...p, description: e.target.value }))} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSettingModal(false)} className="px-4 py-2 rounded-[8px] border border-white/[0.08] text-[12.5px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-[8px] bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-500 transition-colors disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
