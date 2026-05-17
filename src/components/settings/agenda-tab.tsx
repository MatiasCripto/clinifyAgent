'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, Hash, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/use-auth'

// ── Types ────────────────────────────────────────────────────
interface SlotEntry {
  area_id?: string | null
  duration: number
}

interface DaySchedule {
  is_working: boolean
  start_time: string
  end_time: string
  slots: SlotEntry[]
}

type ScheduleMap = Record<string, DaySchedule>

interface ServiceArea {
  id: string
  professional_id: string
  name: string
  duration_min: number
}

interface Professional {
  id: string
  full_name: string
  profile_id?: string | null
}

interface Clinic {
  id: string
  name: string
}

const DURATION_OPTIONS = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60]

const DAY_NAMES: Record<string, string> = {
  '0': 'Lunes', '1': 'Martes', '2': 'Miércoles', '3': 'Jueves', '4': 'Viernes', '5': 'Sábado', '6': 'Domingo',
}
const DAY_KEYS = ['0', '1', '2', '3', '4', '5']

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff); d.setHours(0, 0, 0, 0)
  return d
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 5)
  const month = monday.toLocaleDateString('es-AR', { month: 'long' })
  return `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${month}`
}

function formatDateISO(date: Date): string { return date.toISOString().split('T')[0] }

function defaultDay(): DaySchedule {
  return { is_working: false, start_time: '08:00', end_time: '17:00', slots: [] }
}

// ── Component ─────────────────────────────────────────────────
export function AgendaTab() {
  const { authUser } = useAuth()
  const userProfileId = authUser?.profile?.id
  const userRole = authUser?.role

  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [selectedProId, setSelectedProId] = useState<string>('')
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()))
  const [scheduleMap, setScheduleMap] = useState<ScheduleMap>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStaffLocked, setIsStaffLocked] = useState(false)

  // Clinics & areas
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selectedClinicId, setSelectedClinicId] = useState<string>('')
  const [areas, setAreas] = useState<ServiceArea[]>([])
  const [newAreaName, setNewAreaName] = useState('')
  const [newAreaDuration, setNewAreaDuration] = useState(30)
  const [areasLoading, setAreasLoading] = useState(false)

  // Load professionals
  useEffect(() => {
    fetch('/api/settings/professionals')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProfessionals(data)
          if (userRole === 'staff' && userProfileId) {
            const linked = data.find((p: Professional & { profile_id?: string }) => p.profile_id === userProfileId)
            if (linked) { setSelectedProId(linked.id); setIsStaffLocked(true); return }
          }
          if (data.length > 0) setSelectedProId(data[0].id)
        }
      })
  }, [userRole, userProfileId])

  // Load clinics
  useEffect(() => {
    fetch('/api/settings/clinic')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setClinics(data)
          setSelectedClinicId(data[0].id)
        }
      })
  }, [])

  // Load areas for selected professional
  const loadAreas = useCallback(async () => {
    if (!selectedProId) return
    setAreasLoading(true)
    const res = await fetch(`/api/settings/service-areas?professional_id=${selectedProId}`)
    if (res.ok) setAreas(await res.json())
    setAreasLoading(false)
  }, [selectedProId])

  useEffect(() => { loadAreas() }, [loadAreas])

  // Load schedule
  const loadSchedule = useCallback(async () => {
    if (!selectedProId) return
    setLoading(true); setError(null)
    const weekStr = formatDateISO(monday)
    const res = await fetch(`/api/settings/availability?professional_id=${selectedProId}&week_start=${weekStr}`)
    if (res.ok) {
      const data = await res.json()
      if (data?.schedule) { setScheduleMap(data.schedule); setLoading(false); return }
    }
    const empty: ScheduleMap = {}
    DAY_KEYS.forEach(k => { empty[k] = defaultDay() })
    setScheduleMap(empty)
    setLoading(false)
  }, [selectedProId, monday])

  useEffect(() => { loadSchedule() }, [loadSchedule])

  // Navigation
  function prevWeek() { const d = new Date(monday); d.setDate(d.getDate() - 7); setMonday(d) }
  function nextWeek() { const d = new Date(monday); d.setDate(d.getDate() + 7); setMonday(d) }

  function updateDay(key: string, patch: Partial<DaySchedule>) {
    setScheduleMap(prev => { const next = { ...prev }; next[key] = { ...(next[key] ?? defaultDay()), ...patch }; return next })
    setSaved(false)
  }
  function toggleWorking(key: string) {
    setScheduleMap(prev => { const next = { ...prev }; const cur = next[key] ?? defaultDay(); next[key] = { ...cur, is_working: !cur.is_working }; return next })
    setSaved(false)
  }

  // Add/remove areas
  async function addArea() {
    if (!newAreaName.trim() || !selectedProId) return
    const res = await fetch('/api/settings/service-areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professional_id: selectedProId, name: newAreaName.trim(), duration_min: newAreaDuration }),
    })
    if (res.ok) { setNewAreaName(''); loadAreas() }
  }
  async function removeArea(areaId: string) {
    await fetch('/api/settings/service-areas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: areaId }) })
    loadAreas()
  }

  // Slots management
  function setSlotCount(key: string, count: number) {
    setScheduleMap(prev => {
      const next = { ...prev }; const cur = next[key] ?? defaultDay()
      const clamped = Math.max(1, Math.min(20, count))
      const existing = cur.slots ?? []
      const slots: SlotEntry[] = Array.from({ length: clamped }, (_, i) => ({
        area_id: existing[i]?.area_id ?? null,
        duration: existing[i]?.duration ?? (areas[0]?.duration_min ?? 30),
      }))
      next[key] = { ...cur, slots }
      return next
    })
    setSaved(false)
  }

  function setSlotArea(key: string, index: number, areaId: string | null) {
    setScheduleMap(prev => {
      const next = { ...prev }; const cur = next[key] ?? defaultDay()
      const slots = [...(cur.slots ?? [])]
      if (slots[index]) {
        const area = areas.find(a => a.id === areaId)
        slots[index] = { area_id: areaId || null, duration: area?.duration_min ?? slots[index].duration }
      }
      next[key] = { ...cur, slots }
      return next
    })
    setSaved(false)
  }

  function setSlotDuration(key: string, index: number, duration: number) {
    setScheduleMap(prev => {
      const next = { ...prev }; const cur = next[key] ?? defaultDay()
      const slots = [...(cur.slots ?? [])]
      if (slots[index]) slots[index] = { ...slots[index], duration }
      next[key] = { ...cur, slots }
      return next
    })
    setSaved(false)
  }

  // Save
  async function handleSave() {
    if (!selectedProId || saving) return
    setSaving(true); setError(null)
    const body = {
      professional_id: selectedProId,
      clinic_id: selectedClinicId || null,
      week_start_date: formatDateISO(monday),
      schedule: scheduleMap,
    }
    const res = await fetch('/api/settings/availability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) { const json = await res.json(); setError(json.error ?? 'Error al guardar'); setSaving(false); return }
    setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false)
  }

  const hasAreas = areas.length > 0

  return (
    <div className="space-y-5 max-w-[720px]">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Agenda semanal</h2>
        <p className="text-[12px] text-[var(--subtle)] mt-0.5">Elegí la clínica, el profesional, y configurá áreas por día.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          {error}
        </div>
      )}

      {/* Clinic selector */}
      <div className="space-y-1.5">
        <label className="block text-[12.5px] font-medium text-[var(--foreground)]">Clínica</label>
        <select
          value={selectedClinicId}
          onChange={e => setSelectedClinicId(e.target.value)}
          className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)] transition-colors"
        >
          {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Professional selector */}
      <div className="space-y-1.5">
        <label className="block text-[12.5px] font-medium text-[var(--foreground)]">Profesional</label>
        <select
          value={selectedProId}
          onChange={e => setSelectedProId(e.target.value)}
          disabled={isStaffLocked}
          className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {professionals.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        {isStaffLocked && <p className="text-[10px] text-[var(--subtle)]">Tu agenda personal. Solo vos podés modificarla.</p>}
      </div>

      {/* Areas management */}
      <div className="p-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] space-y-3">
        <label className="block text-[12.5px] font-medium text-[var(--foreground)]">Áreas de atención</label>
        <p className="text-[11px] text-[var(--subtle)]">Definí las áreas en las que trabaja este profesional. Cada área tiene una duración fija.</p>

        {areasLoading ? (
          <p className="text-[12px] text-[var(--subtle)]">Cargando...</p>
        ) : areas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {areas.map(a => (
              <span key={a.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[var(--brand-subtle)] text-[12px] text-[var(--foreground)]">
                {a.name} ({a.duration_min} min)
                <button onClick={() => removeArea(a.id)} className="text-[var(--subtle)] hover:text-red-500"><X size={12} /></button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--subtle)] italic">Sin áreas definidas. Podés agregar abajo.</p>
        )}

        {/* Add area form */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Nombre del área (ej: Masajes)"
            value={newAreaName}
            onChange={e => setNewAreaName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[12.5px] text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)]"
          />
          <select value={newAreaDuration} onChange={e => setNewAreaDuration(parseInt(e.target.value))}
            className="px-2 py-2 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[12px] focus:outline-none focus:border-[var(--brand)]">
            {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
          </select>
          <button onClick={addArea} disabled={!newAreaName.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded-[8px] bg-[var(--brand)] text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50">
            <Plus size={13} /> Agregar
          </button>
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
        <button type="button" onClick={prevWeek} className="p-1.5 rounded-[8px] hover:bg-[var(--border)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"><ChevronLeft size={16} /></button>
        <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--foreground)]"><Calendar size={14} className="text-[var(--brand)]" />{formatWeekLabel(monday)}</div>
        <button type="button" onClick={nextWeek} className="p-1.5 rounded-[8px] hover:bg-[var(--border)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"><ChevronRight size={16} /></button>
      </div>

      {/* Day cards */}
      {loading ? (
        <p className="text-[13px] text-[var(--subtle)] py-8 text-center">Cargando agenda...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {DAY_KEYS.map(key => {
            const day = scheduleMap[key] ?? defaultDay()
            return (
              <div key={key} className={cn(
                'rounded-[12px] border p-4 transition-colors',
                day.is_working ? 'border-[var(--brand)] bg-[var(--brand-subtle)]' : 'border-[var(--border)] bg-[var(--surface-2)]'
              )}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13.5px] font-semibold text-[var(--foreground)]">{DAY_NAMES[key]}</span>
                  <button type="button" onClick={() => toggleWorking(key)}
                    className={cn('relative w-10 h-5 rounded-full transition-colors', day.is_working ? 'bg-[var(--brand)]' : 'bg-[var(--surface-3)]')}>
                    <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', day.is_working ? 'left-5' : 'left-0.5')} />
                  </button>
                </div>

                {day.is_working && (
                  <div className="space-y-3">
                    {/* Time range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-[var(--subtle)] flex items-center gap-1"><Clock size={10} /> Desde</label>
                        <input type="time" value={day.start_time} onChange={e => updateDay(key, { start_time: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] text-[12.5px] text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)] transition-colors [color-scheme:light] dark:[color-scheme:dark]" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-[var(--subtle)] flex items-center gap-1"><Clock size={10} /> Hasta</label>
                        <input type="time" value={day.end_time} onChange={e => updateDay(key, { end_time: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] text-[12.5px] text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)] transition-colors [color-scheme:light] dark:[color-scheme:dark]" />
                      </div>
                    </div>

                    {/* Slot count */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-[var(--subtle)] flex items-center gap-1"><Hash size={10} /> Cantidad de turnos</label>
                      <input type="number" min={1} max={20} value={day.slots?.length ?? 1}
                        onChange={e => setSlotCount(key, parseInt(e.target.value) || 1)}
                        className="w-20 px-2.5 py-1.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] text-[12.5px] text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)] transition-colors" />
                    </div>

                    {/* Slots configuration */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-[var(--subtle)]">Configuración de cada turno</label>
                      <div className="space-y-2">
                        {(day.slots ?? []).map((slot, i) => (
                          <div key={i} className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-[var(--muted)] w-4">#{i + 1}</span>

                            {/* Area selector (if areas exist) or duration selector */}
                            {hasAreas ? (
                              <>
                                <select
                                  value={slot.area_id ?? ''}
                                  onChange={e => setSlotArea(key, i, e.target.value || null)}
                                  className="flex-1 min-w-[140px] px-2 py-1.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] text-[12px] text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                                >
                                  <option value="">Solo duración...</option>
                                  {areas.map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.duration_min} min)</option>
                                  ))}
                                </select>
                                <span className="text-[11px] text-[var(--subtle)]">{slot.duration} min</span>
                              </>
                            ) : (
                              <select value={slot.duration} onChange={e => setSlotDuration(key, i, parseInt(e.target.value))}
                                className="px-2 py-1.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] text-[12px] text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)] transition-colors">
                                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Computed total */}
                    <div className="text-[11px] text-[var(--subtle)] pt-1">
                      Duración total: {(day.slots ?? []).reduce((sum, s) => sum + s.duration, 0)} min
                      {(() => {
                        const total = (day.slots ?? []).reduce((sum, s) => sum + s.duration, 0)
                        if (total > 0 && day.start_time && day.end_time) {
                          const [sh, sm] = day.start_time.split(':').map(Number)
                          const [eh, em] = day.end_time.split(':').map(Number)
                          const available = (eh * 60 + em) - (sh * 60 + sm)
                          const diff = total - available
                          if (diff > 0) return <span className="text-red-500 ml-1">({diff} min más que el horario)</span>
                          if (diff < 0) return <span className="text-green-600 ml-1">({-diff} min libres)</span>
                          return <span className="text-green-600 ml-1">(justo)</span>
                        }
                        return null
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Save */}
      <div className="pt-2">
        <button type="button" disabled={saving} onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity">
          {saved ? (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Guardado</>
          ) : saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
