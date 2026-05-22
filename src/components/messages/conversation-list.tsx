'use client'

import { cn } from '@/lib/utils/cn'
import { getInitials } from '@/lib/utils/formatters'
import { BotStateBadge } from './bot-state-badge'
import type { BotConversation } from '@/lib/types/whatsapp.types'

interface Props {
  conversations: BotConversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  filter: 'all' | 'active' | 'handoff' | 'done'
  onFilterChange: (f: 'all' | 'active' | 'handoff' | 'done') => void
  search: string
  onSearch: (s: string) => void
}

const FILTERS = [
  { key: 'all',     label: 'Todas' },
  { key: 'active',  label: 'Activas' },
  { key: 'handoff', label: '👥 Agente' },
  { key: 'done',    label: 'Cerradas' },
] as const

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hs = Math.floor(mins / 60)
  if (hs < 24) return `${hs}h`
  return `${Math.floor(hs / 24)}d`
}

export function ConversationList({ conversations, selectedId, onSelect, filter, onFilterChange, search, onSearch }: Props) {
  const filtered = conversations.filter(c => {
    const matchSearch = !search || (c.patientName ?? c.phone).toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ? true :
      filter === 'active' ? (c.isActive && c.state !== 'human_handoff') :
      filter === 'handoff' ? c.humanTakeover === true :
      filter === 'done' ? (!c.isActive || c.state === 'closed' || c.state === 'booking_done') : true
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-[var(--border)]">
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Buscar conversación..."
          className="w-full px-3 py-1.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)]"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 px-3 py-2 border-b border-[var(--border)]">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={cn(
              'badge text-[11px] cursor-pointer transition-colors',
              filter === f.key
                ? 'bg-[var(--brand)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--muted)] hover:bg-[var(--surface-3)]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-center text-[12px] text-[var(--subtle)] py-8">Sin conversaciones</p>
        )}
        {filtered.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
              'w-full text-left px-3 py-3 border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors',
              selectedId === conv.id && 'bg-[var(--surface-2)] border-l-2 border-l-[var(--brand)]'
            )}
          >
            <div className="flex items-start gap-2.5">
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                style={{ background: conv.humanTakeover ? '#ef4444' : conv.isActive ? '#6366f1' : '#9ca3af' }}
              >
                {getInitials(conv.patientName ?? conv.phone.slice(-4))}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[13px] font-semibold text-[var(--foreground)] truncate">
                    {conv.patientName ?? conv.phone}
                  </span>
                  <span className="text-[10px] text-[var(--subtle)] flex-shrink-0 ml-1">
                    {relativeTime(conv.lastMessageAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] text-[var(--muted)] truncate flex-1">
                    {conv.lastMessage}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[var(--brand)] text-white text-[9px] flex items-center justify-center flex-shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>

                <div className="mt-1">
                  <BotStateBadge state={conv.state} />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
