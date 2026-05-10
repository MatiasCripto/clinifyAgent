'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Phone, AlertCircle, CheckCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BotStateBadge } from './bot-state-badge'
import { getInitials } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { BotConversation, BotMessage } from '@/lib/types/whatsapp.types'

interface Props {
  conversation: BotConversation
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function shouldShowDate(msgs: BotMessage[], idx: number) {
  if (idx === 0) return true
  const curr = new Date(msgs[idx].timestamp).toDateString()
  const prev = new Date(msgs[idx - 1].timestamp).toDateString()
  return curr !== prev
}

function MessageBubble({ msg }: { msg: BotMessage }) {
  const isOut = msg.direction === 'outbound'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-2 max-w-[85%]', isOut ? 'ml-auto flex-row-reverse' : 'mr-auto')}
    >
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 self-end',
        isOut ? 'bg-[var(--brand)]' : 'bg-[var(--surface-3)]'
      )}>
        {isOut
          ? <Bot size={14} className="text-white" />
          : <User size={14} className="text-[var(--muted)]" />
        }
      </div>

      <div className={cn('flex flex-col gap-0.5', isOut ? 'items-end' : 'items-start')}>
        <div className={cn(
          'px-3 py-2 rounded-[14px] text-[13px] leading-relaxed whitespace-pre-wrap',
          isOut
            ? 'bg-[var(--brand)] text-white rounded-tr-[4px]'
            : 'bg-[var(--surface-2)] text-[var(--foreground)] border border-[var(--border)] rounded-tl-[4px]'
        )}>
          {msg.text}
        </div>

        <div className={cn('flex items-center gap-1.5', isOut ? 'flex-row-reverse' : '')}>
          <span className="text-[10px] text-[var(--subtle)]">{formatTime(msg.timestamp)}</span>
          {isOut && msg.botState && (
            <BotStateBadge state={msg.botState} className="text-[9px]" />
          )}
          {isOut && <CheckCheck size={12} className="text-[var(--subtle)]" />}
        </div>
      </div>
    </motion.div>
  )
}

export function ConversationView({ conversation }: Props) {
  const [manualMsg, setManualMsg] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation.messages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!manualMsg.trim() || sending) return
    setSending(true)
    try {
      await fetch('/api/bot/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: conversation.phone, message: manualMsg }),
      })
      setManualMsg('')
    } catch {
      // silent
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
          style={{ background: conversation.state === 'human_handoff' ? '#ef4444' : conversation.isActive ? '#6366f1' : '#9ca3af' }}
        >
          {getInitials(conversation.patientName ?? conversation.phone.slice(-4))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[var(--foreground)]">
              {conversation.patientName ?? 'Número desconocido'}
            </span>
            {conversation.isActive && (
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Phone size={11} className="text-[var(--subtle)]" />
            <span className="text-[11px] text-[var(--subtle)]">{conversation.phone}</span>
            <BotStateBadge state={conversation.state} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-[var(--subtle)]">{conversation.messageCount} mensajes</p>
          {conversation.unreadCount > 0 && (
            <span className="badge bg-[var(--brand)] text-white text-[10px]">{conversation.unreadCount} nuevos</span>
          )}
        </div>
      </div>

      {/* Human handoff warning */}
      <AnimatePresence>
        {conversation.state === 'human_handoff' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-[12px]">
              <AlertCircle size={14} />
              <span>Este paciente solicitó hablar con un agente humano. El bot está pausado.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {conversation.messages.map((msg, idx) => (
          <div key={msg.id}>
            {shouldShowDate(conversation.messages, idx) && (
              <div className="flex justify-center my-3">
                <span className="text-[10px] text-[var(--subtle)] bg-[var(--surface-2)] px-3 py-1 rounded-full border border-[var(--border)]">
                  {formatDate(msg.timestamp)}
                </span>
              </div>
            )}
            <MessageBubble msg={msg} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Manual send (agent override) */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={manualMsg}
            onChange={e => setManualMsg(e.target.value)}
            placeholder={
              conversation.state === 'human_handoff'
                ? 'Escribir como agente humano...'
                : 'Enviar mensaje manual (override del bot)...'
            }
            className="flex-1 px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)]"
          />
          <button
            type="submit"
            disabled={!manualMsg.trim() || sending}
            className="w-9 h-9 rounded-[10px] bg-[var(--brand)] text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send size={15} />
          </button>
        </form>
        <p className="text-[10px] text-[var(--subtle)] mt-1">
          {conversation.state === 'human_handoff'
            ? '⚠ En modo agente — el bot no responderá automáticamente'
            : 'Los mensajes manuales se envían en nombre de la clínica'
          }
        </p>
      </div>
    </div>
  )
}
