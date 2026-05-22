'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'

interface Props {
  type: string
  data?: Record<string, unknown> | null
  readOnly?: boolean
  onDataChange?: (data: Record<string, unknown>) => void
}

export function ArtifactViewer({ type, data, readOnly = false, onDataChange }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMessage = useCallback((e: MessageEvent) => {
    if (!e.data || typeof e.data !== 'object') return

    if (e.data.type === 'artifact:ready') {
      setReady(true)
      // If we have saved data and it's readOnly, send it to the iframe
      if (readOnly && data) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'artifact:load', data },
          '*'
        )
      }
    }

    if (e.data.type === 'artifact:change' && !readOnly) {
      onDataChange?.(e.data.data as Record<string, unknown>)
    }
  }, [readOnly, data, onDataChange])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  // Send data when switching to readOnly mode or data changes
  useEffect(() => {
    if (ready && readOnly && data) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'artifact:load', data },
        '*'
      )
    }
  }, [ready, readOnly, data])

  if (!type) {
    return (
      <div className="flex items-center justify-center py-8 text-[13px] text-[var(--subtle)]">
        Sin artefacto asignado para esta especialidad.
      </div>
    )
  }

  const src = `/artifacts/${type}.html`

  return (
    <div className="relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)] rounded-[10px]">
          <div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="text-[12px] text-red-500 mb-2">{error}</div>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        className={cn(
          'w-full border border-[var(--border)] rounded-[10px] bg-white',
          ready ? 'opacity-100' : 'opacity-0'
        )}
        style={{ minHeight: 400 }}
        sandbox="allow-scripts allow-same-origin"
        title={`Artefacto: ${type}`}
        onError={() => setError('Error al cargar el artefacto')}
      />
    </div>
  )
}
