import { useEffect, useRef, useState } from 'react'
import type {
  BtcLivePriceUpdate,
  BtcLiveVolumeUpdate,
  RealtimeUserEvent,
} from '../../../types/dashboard'

type SocketEnvelope = {
  event?: unknown
  data?: unknown
}

type DashboardSocketStatus = 'connecting' | 'live' | 'offline'

type UseDashboardSocketParams = {
  enabled: boolean
  onBtcPriceUpdated: (payload: BtcLivePriceUpdate) => void
  onBtcVolumeUpdated: (payload: BtcLiveVolumeUpdate) => void
  onUserCreated?: (payload: RealtimeUserEvent) => void
  onUserUpdated?: (payload: RealtimeUserEvent) => void
}

const BTC_PRICE_UPDATED_EVENT = 'btc.price.updated'
const BTC_VOLUME_UPDATED_EVENT = 'btc.volume.updated'
const USER_CREATED_EVENT = 'user.created'
const USER_UPDATED_EVENT = 'user.updated'
const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 15000

function getDashboardSocketUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  const normalizedBaseUrl = configuredBaseUrl
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
  const accessToken = window.localStorage.getItem('accessToken')
  const tokenQuery = accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''

  if (normalizedBaseUrl.startsWith('https://')) {
    return `${normalizedBaseUrl.replace(/^https:\/\//, 'wss://')}/ws${tokenQuery}`
  }

  return `${normalizedBaseUrl.replace(/^http:\/\//, 'ws://')}/ws${tokenQuery}`
}

function parseBtcLivePriceUpdate(payload: unknown): BtcLivePriceUpdate | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as Record<string, unknown>

  if (candidate.symbol !== 'BTCUSDT') {
    return null
  }

  if (typeof candidate.price !== 'number' || !Number.isFinite(candidate.price)) {
    return null
  }

  if (typeof candidate.updatedAt !== 'string' || candidate.updatedAt.length === 0) {
    return null
  }

  return {
    symbol: 'BTCUSDT',
    price: candidate.price,
    ...(typeof candidate.change24h === 'number' && Number.isFinite(candidate.change24h)
      ? { change24h: candidate.change24h }
      : {}),
    ...(typeof candidate.change24hPercent === 'number' && Number.isFinite(candidate.change24hPercent)
      ? { change24hPercent: candidate.change24hPercent }
      : {}),
    ...(typeof candidate.high24h === 'number' && Number.isFinite(candidate.high24h)
      ? { high24h: candidate.high24h }
      : {}),
    ...(typeof candidate.low24h === 'number' && Number.isFinite(candidate.low24h)
      ? { low24h: candidate.low24h }
      : {}),
    updatedAt: candidate.updatedAt,
  }
}

function parseBtcLiveVolumeUpdate(payload: unknown): BtcLiveVolumeUpdate | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as Record<string, unknown>

  if (candidate.symbol !== 'BTCUSDT') {
    return null
  }

  if (
    candidate.timeframe !== '15m' &&
    candidate.timeframe !== '1h' &&
    candidate.timeframe !== '4h' &&
    candidate.timeframe !== '1d'
  ) {
    return null
  }

  if (typeof candidate.label !== 'string' || candidate.label.length === 0) {
    return null
  }

  if (typeof candidate.volume !== 'number' || !Number.isFinite(candidate.volume)) {
    return null
  }

  if (candidate.color !== '#22c55e' && candidate.color !== '#ef4444') {
    return null
  }

  if (candidate.direction !== 'bullish' && candidate.direction !== 'bearish') {
    return null
  }

  if (typeof candidate.updatedAt !== 'string' || candidate.updatedAt.length === 0) {
    return null
  }

  return {
    symbol: 'BTCUSDT',
    timeframe: candidate.timeframe,
    label: candidate.label,
    volume: candidate.volume,
    color: candidate.color,
    direction: candidate.direction,
    updatedAt: candidate.updatedAt,
  }
}

function parseRealtimeUserEvent(payload: unknown): RealtimeUserEvent | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as Record<string, unknown>

  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }

  if (typeof candidate.email !== 'string' || candidate.email.length === 0) {
    return null
  }

  if (typeof candidate.displayName !== 'string' || candidate.displayName.length === 0) {
    return null
  }

  if (typeof candidate.role !== 'string' || candidate.role.length === 0) {
    return null
  }

  if (typeof candidate.isActive !== 'boolean') {
    return null
  }

  if (typeof candidate.createdAt !== 'string' || candidate.createdAt.length === 0) {
    return null
  }

  if (
    candidate.updatedAt !== undefined &&
    (typeof candidate.updatedAt !== 'string' || candidate.updatedAt.length === 0)
  ) {
    return null
  }

  return {
    id: candidate.id,
    email: candidate.email,
    displayName: candidate.displayName,
    role: candidate.role,
    isActive: candidate.isActive,
    createdAt: candidate.createdAt,
    ...(typeof candidate.updatedAt === 'string' ? { updatedAt: candidate.updatedAt } : {}),
  }
}

export function useDashboardSocket({
  enabled,
  onBtcPriceUpdated,
  onBtcVolumeUpdated,
  onUserCreated,
  onUserUpdated,
}: UseDashboardSocketParams): DashboardSocketStatus {
  const [status, setStatus] = useState<DashboardSocketStatus>('offline')
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const latestCallbackRef = useRef(onBtcPriceUpdated)
  const latestVolumeCallbackRef = useRef(onBtcVolumeUpdated)
  const latestUserCreatedCallbackRef = useRef(onUserCreated)
  const latestUserUpdatedCallbackRef = useRef(onUserUpdated)

  latestCallbackRef.current = onBtcPriceUpdated
  latestVolumeCallbackRef.current = onBtcVolumeUpdated
  latestUserCreatedCallbackRef.current = onUserCreated
  latestUserUpdatedCallbackRef.current = onUserUpdated

  useEffect(() => {
    if (!enabled) {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      socketRef.current?.close()
      socketRef.current = null
      reconnectAttemptRef.current = 0
      setStatus('offline')
      return
    }

    let cancelled = false

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const cleanupSocket = () => {
      if (socketRef.current) {
        socketRef.current.onopen = null
        socketRef.current.onmessage = null
        socketRef.current.onerror = null
        socketRef.current.onclose = null
        socketRef.current.close()
        socketRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimerRef.current !== null) {
        return
      }

      reconnectAttemptRef.current += 1
      const delayMs = Math.min(
        RECONNECT_BASE_DELAY_MS * 2 ** (reconnectAttemptRef.current - 1),
        RECONNECT_MAX_DELAY_MS,
      )

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delayMs)
    }

    const connect = () => {
      if (cancelled || socketRef.current) {
        return
      }

      setStatus('connecting')

      const socket = new window.WebSocket(getDashboardSocketUrl())
      socketRef.current = socket

      socket.onopen = () => {
        if (socketRef.current !== socket) {
          return
        }

        reconnectAttemptRef.current = 0
        setStatus('live')
      }

      socket.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data) as SocketEnvelope

          if (envelope.event === BTC_PRICE_UPDATED_EVENT) {
            const payload = parseBtcLivePriceUpdate(envelope.data)
            if (!payload) {
              return
            }

            latestCallbackRef.current(payload)
            return
          }

          if (envelope.event === BTC_VOLUME_UPDATED_EVENT) {
            const payload = parseBtcLiveVolumeUpdate(envelope.data)
            if (!payload) {
              return
            }

            latestVolumeCallbackRef.current(payload)
            return
          }

          if (envelope.event === USER_CREATED_EVENT) {
            const payload = parseRealtimeUserEvent(envelope.data)
            if (!payload) {
              return
            }

            latestUserCreatedCallbackRef.current?.(payload)
            return
          }

          if (envelope.event !== USER_UPDATED_EVENT) {
            return
          }

          const payload = parseRealtimeUserEvent(envelope.data)
          if (!payload) {
            return
          }

          latestUserUpdatedCallbackRef.current?.(payload)
        } catch {
          // Ignore malformed socket messages and keep the connection alive.
        }
      }

      socket.onerror = () => {
        if (socketRef.current !== socket) {
          return
        }

        setStatus('offline')
      }

      socket.onclose = () => {
        if (socketRef.current !== socket) {
          return
        }

        socketRef.current = null
        setStatus('offline')

        if (!cancelled) {
          scheduleReconnect()
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      clearReconnectTimer()
      cleanupSocket()
      setStatus('offline')
    }
  }, [enabled])

  return status
}
