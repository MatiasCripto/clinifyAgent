'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { Wifi, WifiOff, RefreshCw, LogOut, Loader2 } from 'lucide-react'
import Image from 'next/image'

type ConnectionState = 'loading' | 'open' | 'close' | 'connecting' | 'qr'

interface Props {
  instance?: string
}

export function WhatsAppQR({ instance = 'clinify' }: Props) {
  const [connState, setConnState] = useState<ConnectionState>('loading')
  const [qrBase64,  setQrBase64]  = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const fetchStatus = useCallback(async (isInitial = false) => {
    try {
      const res = await fetch(`/api/evolution/status?instance=${instance}`)
      const data = await res.json()
      const state: string = data.state ?? 'close'
      if (state === 'open') {
        setConnState('open')
        setQrBase64(null)
        stopPoll()
      } else if (isInitial) {
        // Solo en la carga inicial mostramos 'close'
        setConnState('close')
      }
      // Durante el QR, no cambiar el estado — mantener el QR visible
    } catch {
      if (isInitial) setConnState('close')
    }
  }, [instance, stopPoll])

  // Initial status check
  useEffect(() => {
    fetchStatus(true)
  }, [fetchStatus])

  // Poll when waiting for QR scan (cada 5 seg, no 3)
  useEffect(() => {
    if (connState === 'qr' || connState === 'connecting') {
      stopPoll()
      pollRef.current = setInterval(() => fetchStatus(false), 5000)
    } else {
      stopPoll()
    }
    return stopPoll
  }, [connState, fetchStatus, stopPoll])

  async function handleConnect() {
    setError(null)
    setConnState('connecting')
    setQrBase64(null)
    try {
      const res = await fetch('/api/evolution/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance }),
      })
      const data = await res.json()

      if (data?.instance?.state === 'open' || data?.state === 'open') {
        setConnState('open')
        return
      }

      // QR code returned
      const qr: string = data?.base64 ?? data?.qrcode?.base64 ?? data?.qr?.base64 ?? null
      if (qr) {
        setQrBase64(qr)
        setConnState('qr')
      } else {
        setError('No se pudo obtener el QR. Verificá que Evolution API esté corriendo.')
        setConnState('close')
      }
    } catch (e) {
      setError('Error de conexión con Evolution API')
      setConnState('close')
    }
  }

  async function handleDisconnect() {
    setConnState('loading')
    await fetch('/api/evolution/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance }),
    })
    setConnState('close')
    setQrBase64(null)
  }

  async function handleRefreshQR() {
    setQrBase64(null)
    await handleConnect()
  }

  return (
    <div className="space-y-4">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {connState === 'loading' || connState === 'connecting' ? (
            <Loader2 size={15} className="animate-spin text-[var(--subtle)]" />
          ) : connState === 'open' ? (
            <Wifi size={15} className="text-green-500" />
          ) : (
            <WifiOff size={15} className="text-[var(--subtle)]" />
          )}
          <span className={cn(
            'text-[13px] font-medium',
            connState === 'open' ? 'text-green-600' :
            connState === 'qr'   ? 'text-amber-600' :
            connState === 'connecting' ? 'text-[var(--subtle)]' :
            'text-[var(--muted)]'
          )}>
            {connState === 'open'       ? '● Conectado'              :
             connState === 'qr'         ? 'Esperando escaneo del QR' :
             connState === 'connecting' ? 'Conectando...'            :
             connState === 'loading'    ? 'Verificando estado...'    :
             '○ Desconectado'}
          </span>
        </div>

        <div className="flex gap-2">
          {connState === 'open' && (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-red-200 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut size={12} /> Desconectar
            </button>
          )}
          {connState === 'close' && (
            <button
              onClick={handleConnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--brand)] text-white text-[12px] font-semibold hover:bg-[var(--brand-dark)] transition-colors"
            >
              Conectar WhatsApp
            </button>
          )}
          {connState === 'qr' && (
            <button
              onClick={handleRefreshQR}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <RefreshCw size={12} /> Nuevo QR
            </button>
          )}
        </div>
      </div>

      {/* QR code */}
      {connState === 'qr' && qrBase64 && (
        <div className="flex flex-col items-center gap-3 p-5 rounded-[14px] bg-white border border-[var(--border)]">
          <Image
            src={qrBase64}
            alt="WhatsApp QR Code"
            width={200}
            height={200}
            className="rounded-[8px]"
            unoptimized
          />
          <p className="text-[12px] text-center text-[var(--muted)]">
            Abrí WhatsApp en tu teléfono → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong> y escaneá este código.
          </p>
          <p className="text-[11px] text-[var(--subtle)]">El QR expira en ~60 segundos. Usá &quot;Nuevo QR&quot; si vence.</p>
        </div>
      )}

      {/* Connected state */}
      {connState === 'open' && (
        <div className="flex items-center gap-3 p-4 rounded-[12px] bg-green-50 border border-green-200">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[18px]">✅</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-green-800">WhatsApp conectado correctamente</p>
            <p className="text-[11px] text-green-600">El bot está activo y recibiendo mensajes en esta instancia.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-[10px] bg-red-50 border border-red-200">
          <p className="text-[12px] text-red-700">{error}</p>
        </div>
      )}

      {/* Instance info */}
      <p className="text-[11px] text-[var(--subtle)]">
        Instancia: <code className="font-mono bg-[var(--surface-2)] px-1 rounded">{instance}</code>
      </p>
    </div>
  )
}
