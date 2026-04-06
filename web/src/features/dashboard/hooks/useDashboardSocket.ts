import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  BtcLivePriceUpdate,
  BtcLiveVolumeUpdate,
  RealtimeUserEvent,
} from '../../../types/dashboard'
import { getAccessToken } from '../../../services/auth-storage'

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

  return configuredBaseUrl
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
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
  const socketRef = useRef<Socket | null>(null)
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
      socketRef.current?.disconnect()
      socketRef.current = null
      setStatus('offline')
      return
    }

    const accessToken = getAccessToken()
    setStatus('connecting')

    const socket = io(getDashboardSocketUrl(), {
      path: '/ws',
      transports: ['websocket'],
      auth: accessToken ? { token: accessToken } : undefined,
      reconnection: true,
      reconnectionDelay: RECONNECT_BASE_DELAY_MS,
      reconnectionDelayMax: RECONNECT_MAX_DELAY_MS,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      if (socketRef.current !== socket) {
        return
      }

      setStatus('live')
    })

    socket.on('disconnect', () => {
      if (socketRef.current !== socket) {
        return
      }

      setStatus('connecting')
    })

    socket.on('connect_error', () => {
      if (socketRef.current !== socket) {
        return
      }

      setStatus('connecting')
    })

    socket.on(BTC_PRICE_UPDATED_EVENT, (payload: unknown) => {
      const parsed = parseBtcLivePriceUpdate(payload)
      if (!parsed) {
        return
      }

      latestCallbackRef.current(parsed)
    })

    socket.on(BTC_VOLUME_UPDATED_EVENT, (payload: unknown) => {
      const parsed = parseBtcLiveVolumeUpdate(payload)
      if (!parsed) {
        return
      }

      latestVolumeCallbackRef.current(parsed)
    })

    socket.on(USER_CREATED_EVENT, (payload: unknown) => {
      const parsed = parseRealtimeUserEvent(payload)
      if (!parsed) {
        return
      }

      latestUserCreatedCallbackRef.current?.(parsed)
    })

    socket.on(USER_UPDATED_EVENT, (payload: unknown) => {
      const parsed = parseRealtimeUserEvent(payload)
      if (!parsed) {
        return
      }

      latestUserUpdatedCallbackRef.current?.(parsed)
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()

      if (socketRef.current === socket) {
        socketRef.current = null
      }

      setStatus('offline')
    }
  }, [enabled])

  return status
}
