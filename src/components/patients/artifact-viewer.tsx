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
  const [loading, setLoading] = useState(true)

  // Fallback: hide spinner after 2s even if artifact:ready never arrives
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 2000)
    return () => clearTimeout(t)
  }, [type])

  const handleMessage = useCallback((e: MessageEvent) => {
    if (!e.data || typeof e.data !== 'object') return

    if (e.data.type === 'artifact:ready') {
      setLoading(false)
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

  // Send data when it changes in readOnly mode
  useEffect(() => {
    if (!loading && readOnly && data) {
      // Small delay to ensure iframe is loaded
      const t = setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'artifact:load', data },
          '*'
        )
      }, 500)
      return () => clearTimeout(t)
    }
  }, [loading, readOnly, data])

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
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)] rounded-[10px] z-10">
          <div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        className={cn(
          'w-full border border-[var(--border)] rounded-[10px] bg-white',
          loading ? 'invisible' : 'visible'
        )}
        style={{ minHeight: 400 }}
        sandbox="allow-scripts allow-same-origin"
        title={`Artefacto: ${type}`}
      />
    </div>
  )
}
