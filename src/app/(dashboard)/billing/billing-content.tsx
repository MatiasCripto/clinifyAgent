'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { Plus, RefreshCw, Pencil, Trash2, Printer, CheckCircle2, AlertCircle, Clock, XCircle, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import type { Patient } from '@/lib/types'

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
type InvoiceType   = 'FC-A' | 'FC-B' | 'FC-C' | 'NC-A' | 'NC-B' | 'ND'

interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface Invoice {
  id: string
  clinic_id: string
  patient_id: string | null
  invoice_number: string
  invoice_date: string
  due_date: string | null
  status: InvoiceStatus
  invoice_type: string
  currency: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  notes: string | null
  paid_at: string | null
  created_at: string
  items?: InvoiceItem[]
  patients?: { id: string; first_name: string; last_name: string } | null
}

const STATUS_CFG: Record<InvoiceStatus, { label: string; style: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  draft:     { label: 'Borrador',  style: 'bg-gray-100 text-gray-600 border-gray-200',   icon: Clock },
  sent:      { label: 'Enviada',   style: 'bg-blue-100 text-blue-600 border-blue-200',   icon: Receipt },
  paid:      { label: 'Pagada',    style: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  overdue:   { label: 'Vencida',   style: 'bg-red-100 text-red-600 border-red-200',      icon: AlertCircle },
  cancelled: { label: 'Cancelada', style: 'bg-gray-100 text-gray-400 border-gray-200',   icon: XCircle },
}

const INVOICE_TYPES: InvoiceType[] = ['FC-A', 'FC-B', 'FC-C', 'NC-A', 'NC-B', 'ND']

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(n: number, currency = 'ARS') {
  return `${currency === 'ARS' ? '$' : 'USD '}${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const EMPTY_ITEM: InvoiceItem = { description: '', quantity: 1, unit_price: 0, total: 0 }

export function BillingDashboard() {
  const { currentClinic } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<InvoiceStatus | 'all'>('all')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Invoice | null>(null)
  const [form, setForm] = useState({
    patient_id: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    invoice_type: 'FC-C' as InvoiceType,
    currency: 'ARS',
    tax_rate: 21,
    notes: '',
  })
  const [items, setItems] = useState<InvoiceItem[]>([{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Print invoice state
  const [printing, setPrinting] = useState<Invoice | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [invRes] = await Promise.all([
      fetch('/api/invoices'),
    ])
    if (invRes.ok) setInvoices(await invRes.json())

    if (currentClinic) {
      const sb = createClient()
      const { data } = await sb
        .from('patients')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .order('last_name')
      setPatients((data ?? []) as Patient[])
    }
    setLoading(false)
  }, [currentClinic])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ patient_id: '', invoice_date: new Date().toISOString().slice(0, 10), due_date: '', invoice_type: 'FC-C', currency: 'ARS', tax_rate: 21, notes: '' })
    setItems([{ ...EMPTY_ITEM }])
    setError(null)
    setShowModal(true)
  }

  function updateItem(idx: number, field: keyof InvoiceItem, value: string | number) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [field]: value }
      updated.total = updated.quantity * updated.unit_price
      return updated
    }))
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const taxAmt   = subtotal * (form.tax_rate / 100)
  const total    = subtotal + taxAmt

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items: items.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })) }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error'); setSaving(false); return }
    setInvoices(prev => [json, ...prev])
    setShowModal(false)
    setSaving(false)
  }

  async function markPaid(inv: Invoice) {
    await fetch('/api/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inv.id, status: 'paid' }),
    })
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i))
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta factura?')) return
    await fetch(`/api/invoices?id=${id}`, { method: 'DELETE' })
    setInvoices(prev => prev.filter(i => i.id !== id))
  }

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter)

  const totals = {
    paid:    invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    pending: invoices.filter(i => i.status === 'sent' || i.status === 'draft').reduce((s, i) => s + i.total, 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total, 0),
  }

  const counts = {
    all: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    cancelled: invoices.filter(i => i.status === 'cancelled').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--foreground)]">Facturación</h1>
          <p className="text-[12px] text-[var(--subtle)] mt-0.5">Comprobantes y control de pagos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-[10px] border border-[var(--border)] text-[var(--subtle)] hover:bg-[var(--surface-2)] transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity">
            <Plus size={14} /> Nueva factura
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Cobrado', value: totals.paid, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 },
          { label: 'Pendiente', value: totals.pending, color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
          { label: 'Vencido', value: totals.overdue, color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={cn('card p-4 flex items-center gap-4')}>
              <div className={cn('w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0', s.bg)}>
                <Icon size={18} className={s.color} />
              </div>
              <div>
                <p className="text-[20px] font-bold text-[var(--foreground)] leading-none">{fmtMoney(s.value)}</p>
                <p className="text-[11px] text-[var(--subtle)] mt-0.5">{s.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        {(['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={cn('px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors -mb-px', filter === s ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--subtle)] hover:text-[var(--foreground)]')}>
            {s === 'all' ? 'Todas' : STATUS_CFG[s]?.label ?? s}
            <span className="ml-1 text-[10px] opacity-60">({counts[s] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Comprobante</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Paciente</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Fecha</th>
                <th className="text-right px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Total</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" /></div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[12px] text-[var(--subtle)]">Sin facturas en esta categoría.</td></tr>
              ) : filtered.map(inv => {
                const cfg   = STATUS_CFG[inv.status]
                const Icon  = cfg.icon
                const pat   = inv.patients as { id: string; first_name: string; last_name: string } | null
                return (
                  <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--foreground)]">{inv.invoice_number}</p>
                      <p className="text-[11px] text-[var(--subtle)]">{inv.invoice_type} · {inv.currency}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {pat ? `${pat.first_name} ${pat.last_name}` : <span className="text-[var(--subtle)]">Particular</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{fmtDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--foreground)]">{fmtMoney(inv.total, inv.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border font-medium', cfg.style)}>
                        <Icon size={11} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button onClick={() => markPaid(inv)} className="px-2.5 py-1 rounded-[6px] text-[10.5px] font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors whitespace-nowrap">
                            Marcar pagada
                          </button>
                        )}
                        <button
                          onClick={() => setPrinting(inv)}
                          className="p-1.5 rounded-[7px] text-[var(--subtle)] hover:text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
                          title="Imprimir"
                        >
                          <Printer size={13} />
                        </button>
                        <button onClick={() => handleDelete(inv.id)} className="p-1.5 rounded-[7px] text-[var(--subtle)] hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create invoice modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] w-full max-w-[600px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
              <div className="flex items-center gap-2.5">
                <Receipt size={16} className="text-[var(--brand)]" />
                <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Nueva factura</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[var(--subtle)] hover:text-[var(--foreground)] text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]"><AlertCircle size={13} /> {error}</div>}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11.5px] font-medium text-[var(--foreground)] mb-1.5">Tipo</label>
                  <select value={form.invoice_type} onChange={e => setForm(f => ({ ...f, invoice_type: e.target.value as InvoiceType }))} className="input w-full">
                    {INVOICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-[var(--foreground)] mb-1.5">Fecha</label>
                  <input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} className="input w-full" required />
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-[var(--foreground)] mb-1.5">Vencimiento</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="input w-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-medium text-[var(--foreground)] mb-1.5">Paciente (opcional)</label>
                  <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))} className="input w-full">
                    <option value="">Particular</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-[var(--foreground)] mb-1.5">Moneda / IVA%</label>
                  <div className="flex gap-2">
                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="input flex-1">
                      <option value="ARS">ARS $</option>
                      <option value="USD">USD $</option>
                    </select>
                    <input type="number" value={form.tax_rate} min={0} max={100} onChange={e => setForm(f => ({ ...f, tax_rate: parseFloat(e.target.value) }))} className="input w-20" placeholder="21" />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11.5px] font-medium text-[var(--foreground)]">Ítems / Servicios</label>
                  <button type="button" onClick={() => setItems(p => [...p, { ...EMPTY_ITEM }])} className="text-[11px] text-[var(--brand)] hover:opacity-80 flex items-center gap-1">
                    <Plus size={11} /> Agregar ítem
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_80px_100px_80px] gap-2 text-[10px] font-medium text-[var(--subtle)] px-1">
                    <span>Descripción</span><span>Cant.</span><span>Precio unit.</span><span>Total</span>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_80px_100px_80px] gap-2 items-center">
                      <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Obturación, extracción..." className="input text-[12px]" required />
                      <input type="number" min={1} step={0.5} value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))} className="input text-[12px] text-center" />
                      <input type="number" min={0} step={100} value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))} className="input text-[12px] text-right" />
                      <div className="flex items-center justify-between">
                        <span className="text-[11.5px] font-medium text-[var(--muted)]">{fmtMoney(item.total, form.currency)}</span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-[var(--subtle)] hover:text-red-500 ml-1"><XCircle size={13} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-[10px] bg-[var(--surface-2)] p-3 space-y-1.5">
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-[var(--muted)]">Subtotal</span>
                  <span className="font-medium text-[var(--foreground)]">{fmtMoney(subtotal, form.currency)}</span>
                </div>
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-[var(--muted)]">IVA ({form.tax_rate}%)</span>
                  <span className="text-[var(--muted)]">{fmtMoney(taxAmt, form.currency)}</span>
                </div>
                <div className="flex justify-between text-[14px] font-bold border-t border-[var(--border)] pt-1.5 mt-1.5">
                  <span className="text-[var(--foreground)]">Total</span>
                  <span className="text-[var(--brand)]">{fmtMoney(total, form.currency)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-[var(--foreground)] mb-1.5">Notas</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones, condiciones de pago..." className="input w-full resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">{saving ? 'Generando...' : 'Generar factura'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print invoice modal */}
      {printing && <InvoicePrintView invoice={printing} onClose={() => setPrinting(null)} />}
    </div>
  )
}

function InvoicePrintView({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const pat = invoice.patients as { id: string; first_name: string; last_name: string } | null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-[16px] w-full max-w-[500px] shadow-2xl overflow-hidden">
        {/* Print bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 print:hidden">
          <span className="text-[13px] font-semibold text-gray-700">Vista previa · {invoice.invoice_number}</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--brand)] text-white text-[12px] font-semibold hover:opacity-90 transition-opacity">
              <Printer size={13} /> Imprimir / PDF
            </button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-[8px] border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-100 transition-colors">Cerrar</button>
          </div>
        </div>

        {/* Invoice body */}
        <div id="invoice-print" className="p-6 bg-white">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[20px] font-bold text-gray-800">Factura {invoice.invoice_type}</p>
              <p className="text-[12px] text-gray-500 mt-0.5">{invoice.invoice_number}</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-gray-500">Fecha: <span className="font-medium text-gray-700">{new Date(invoice.invoice_date).toLocaleDateString('es-AR')}</span></p>
              {invoice.due_date && <p className="text-[12px] text-gray-500">Vto: <span className="font-medium text-gray-700">{new Date(invoice.due_date).toLocaleDateString('es-AR')}</span></p>}
            </div>
          </div>

          {pat && (
            <div className="mb-5 p-3 bg-gray-50 rounded-[8px]">
              <p className="text-[11px] text-gray-500 mb-0.5">CLIENTE</p>
              <p className="text-[13px] font-semibold text-gray-800">{pat.first_name} {pat.last_name}</p>
            </div>
          )}

          <table className="w-full mb-4">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 text-[11px] font-semibold text-gray-500 uppercase">Descripción</th>
                <th className="text-center py-2 text-[11px] font-semibold text-gray-500 uppercase w-16">Cant.</th>
                <th className="text-right py-2 text-[11px] font-semibold text-gray-500 uppercase w-24">Precio</th>
                <th className="text-right py-2 text-[11px] font-semibold text-gray-500 uppercase w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items ?? []).map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 text-[12.5px] text-gray-700">{item.description}</td>
                  <td className="py-2 text-[12.5px] text-gray-600 text-center">{item.quantity}</td>
                  <td className="py-2 text-[12.5px] text-gray-600 text-right">{fmtMoney(item.unit_price, invoice.currency)}</td>
                  <td className="py-2 text-[12.5px] font-medium text-gray-800 text-right">{fmtMoney(item.total, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-gray-200 pt-3 space-y-1">
            <div className="flex justify-between text-[12px] text-gray-600">
              <span>Subtotal</span>
              <span>{fmtMoney(invoice.subtotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-[12px] text-gray-600">
              <span>IVA ({invoice.tax_rate}%)</span>
              <span>{fmtMoney(invoice.tax_amount, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-[14px] font-bold border-t border-gray-300 pt-2 mt-2">
              <span>Total {invoice.currency}</span>
              <span>{fmtMoney(invoice.total, invoice.currency)}</span>
            </div>
          </div>

          {invoice.notes && <p className="mt-4 text-[11px] text-gray-400 border-t border-gray-100 pt-3">{invoice.notes}</p>}

          <div className="mt-6 text-center">
            <p className="text-[10px] text-gray-400">Comprobante generado digitalmente · {new Date().toLocaleDateString('es-AR')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
