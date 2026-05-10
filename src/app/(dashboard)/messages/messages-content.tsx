'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bot, MessageSquare, Users, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { createClient } from '@supabase/supabase-js'
import { StatCard } from '@/components/ui/stat-card'
import type { BotState } from '@/lib/types/whatsapp.types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface WaConversation {
  id: string
  phone: string
  name: string | null
  bot_state: BotState
  is_active: boolean
  handoff: boolean
  last_msg_at: string
}

interface WaMessage {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  content: string
  created_at: string
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'ahora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

const STATE_LABELS: Record<string, string> = {
  idle: 'Inactivo', greeting: 'Saludando', identify_patient: 'Identificando',
  main_menu: 'Menú', booking_specialty: 'Eligiendo especialidad',
  booking_professional: 'Eligiendo profesional', booking_date: 'Eligiendo fecha',
  booking_time: 'Eligiendo hora', booking_confirm: 'Confirmando turno',
  booking_done: 'Turno agendado', cancel_select: 'Cancelando',
  cancel_confirm: 'Confirmando cancelación', reschedule: 'Reprogramando',
  nps_survey: 'Encuesta NPS', human_handoff: 'Derivado a humano', closed: 'Cerrado',
}

export function MessagesContent() {
  const [conversations, setConversations] = useState<WaConversation[]>([])
  const [messages, setMessages]           = useState<WaMessage[]>([])
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [loading, setLoading]             = useState(true)

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('wa_conversations')
      .select('*')
      .order('last_msg_at', { ascending: false })
    if (data) setConversations(data)
    setLoading(false)
  }, [])

  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('wa_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }, [])

  useEffect(() => {
    loadConversations()

    const channel = supabase
      .channel('wa-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => {
        loadConversations()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_messages' }, (payload) => {
        const msg = payload.new as WaMessage
        if (msg.conversation_id === selectedId) {
          setMessages(prev => [...prev, msg])
        }
        loadConversations()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadConversations, selectedId])

  useEffect(() => {
    if (selectedId) loadMessages(selectedId)
    else setMessages([])
  }, [selectedId, loadMessages])

  const selected = conversations.find(c => c.id === selectedId) ?? null

  const stats = {
    active:  conversations.filter(c => c.is_active && !c.handoff).length,
    handoff: conversations.filter(c => c.handoff).length,
    total:   conversations.length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto h-[calc(100vh-96px)] flex flex-col gap-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">WhatsApp Bot</h1>
          <p className="text-[13px] text-[var(--subtle)] mt-0.5">
            Conversaciones reales · Evolution API · {stats.active} activas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        {[
          { label: 'Activas',   value: stats.active,  sub: 'bot respondiendo', icon: Bot,          color: '#6366f1', delay: 0    },
          { label: 'Derivadas', value: stats.handoff, sub: 'requieren atención', icon: Users,       color: '#ef4444', delay: 0.05 },
          { label: 'Total',     value: stats.total,   sub: 'conversaciones',   icon: MessageSquare, color: '#10b981', delay: 0.1  },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: s.delay } }}>
            <StatCard label={s.label} value={s.value} sub={s.sub} icon={s.icon} iconColor={s.color} />
          </motion.div>
        ))}
      </div>

      {conversations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--subtle)]">
          <MessageSquare size={40} strokeWidth={1.5} />
          <p className="text-[14px] font-medium">Sin conversaciones aún</p>
          <p className="text-[12px]">Mandá un WhatsApp al número vinculado para empezar</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[300px_1fr] gap-4 min-h-0">
          {/* Lista */}
          <div className="card overflow-hidden flex flex-col">
            <div className="px-3 pt-3 pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-[var(--brand)]" />
                <span className="text-[13px] font-semibold text-[var(--foreground)]">Conversaciones</span>
                {stats.handoff > 0 && (
                  <span className="badge bg-rose-100 text-rose-700 text-[10px] ml-auto">
                    {stats.handoff} urgente{stats.handoff > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left px-3 py-3 border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors ${selectedId === conv.id ? 'bg-[var(--surface-2)]' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--brand)] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                      {(conv.name ?? conv.phone).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-[var(--foreground)] truncate">
                          {conv.name ?? conv.phone}
                        </span>
                        <span className="text-[10px] text-[var(--subtle)] flex-shrink-0 ml-1">
                          {formatRelative(conv.last_msg_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${conv.handoff ? 'bg-rose-500' : conv.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        <span className="text-[11px] text-[var(--subtle)] truncate">
                          {STATE_LABELS[conv.bot_state] ?? conv.bot_state}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Vista de mensajes */}
          <div className="card overflow-hidden flex flex-col">
            {selected ? (
              <>
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-[var(--brand)] flex items-center justify-center text-white text-[11px] font-bold">
                    {(selected.name ?? selected.phone).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--foreground)]">{selected.name ?? selected.phone}</p>
                    <p className="text-[11px] text-[var(--subtle)]">{selected.phone} · {STATE_LABELS[selected.bot_state]}</p>
                  </div>
                  {selected.handoff && (
                    <span className="ml-auto badge bg-rose-100 text-rose-700 text-[10px]">Derivado a humano</span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-[var(--subtle)] text-[13px]">
                      Cargando mensajes...
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] px-3 py-2 rounded-[12px] text-[13px] leading-relaxed ${
                          msg.direction === 'outbound'
                            ? 'bg-[var(--brand)] text-white rounded-br-[4px]'
                            : 'bg-[var(--surface-2)] text-[var(--foreground)] rounded-bl-[4px]'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-white/70' : 'text-[var(--subtle)]'}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--subtle)]">
                <MessageSquare size={32} strokeWidth={1.5} />
                <p className="text-[13px]">Seleccioná una conversación</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
