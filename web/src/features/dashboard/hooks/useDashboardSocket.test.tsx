import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDashboardSocket } from './useDashboardSocket'

class MockSocket {
  static instances: MockSocket[] = []

  private handlers = new Map<string, Set<(...args: unknown[]) => void>>()
  disconnect = vi.fn()
  removeAllListeners = vi.fn(() => {
    this.handlers.clear()
  })

  constructor(public readonly url: string, public readonly options?: Record<string, unknown>) {
    MockSocket.instances.push(this)
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    const registered = this.handlers.get(event) ?? new Set<(...args: unknown[]) => void>()
    registered.add(handler)
    this.handlers.set(event, registered)
    return this
  }

  emitEvent(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach((handler) => {
      handler(payload)
    })
  }

  static reset() {
    MockSocket.instances = []
  }
}

vi.mock('socket.io-client', () => ({
  io: (url: string, options?: Record<string, unknown>) => new MockSocket(url, options),
}))

describe('useDashboardSocket', () => {
  beforeEach(() => {
    MockSocket.reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dispatches user.created and user.updated events to the latest callbacks', async () => {
    const onUserCreated = vi.fn()
    const onUserUpdated = vi.fn()

    const { result, unmount } = renderHook(() =>
      useDashboardSocket({
        enabled: true,
        onBtcPriceUpdated: vi.fn(),
        onBtcVolumeUpdated: vi.fn(),
        onUserCreated,
        onUserUpdated,
      }),
    )

    const socket = MockSocket.instances[0]

    act(() => {
      socket.emitEvent('connect')
    })

    expect(result.current).toBe('live')

    act(() => {
      socket.emitEvent('user.created', {
        id: 'user-1',
        email: 'new@example.com',
        displayName: 'New User',
        role: 'USER',
        isActive: true,
        createdAt: '2026-04-01T10:00:00.000Z',
      })
      socket.emitEvent('user.updated', {
        id: 'user-2',
        email: 'updated@example.com',
        displayName: 'Updated User',
        role: 'ADMIN',
        isActive: true,
        createdAt: '2026-04-01T09:00:00.000Z',
        updatedAt: '2026-04-01T10:05:00.000Z',
      })
    })

    expect(onUserCreated).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'new@example.com',
      displayName: 'New User',
      role: 'USER',
      isActive: true,
      createdAt: '2026-04-01T10:00:00.000Z',
    })
    expect(onUserUpdated).toHaveBeenCalledWith({
      id: 'user-2',
      email: 'updated@example.com',
      displayName: 'Updated User',
      role: 'ADMIN',
      isActive: true,
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T10:05:00.000Z',
    })

    unmount()

    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1)
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
  })

  it('stays reconnectable after disconnect events and still delivers later price updates', async () => {
    const onPriceUpdated = vi.fn()

    const { result } = renderHook(() =>
      useDashboardSocket({
        enabled: true,
        onBtcPriceUpdated: onPriceUpdated,
        onBtcVolumeUpdated: vi.fn(),
      }),
    )

    const socket = MockSocket.instances[0]

    act(() => {
      socket.emitEvent('connect')
    })

    expect(result.current).toBe('live')

    act(() => {
      socket.emitEvent('disconnect')
    })

    expect(result.current).toBe('connecting')

    act(() => {
      socket.emitEvent('connect')
      socket.emitEvent('btc.price.updated', {
        symbol: 'BTCUSDT',
        price: 70123,
        updatedAt: '2026-04-01T10:00:00.000Z',
      })
    })

    expect(result.current).toBe('live')
    expect(onPriceUpdated).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      price: 70123,
      updatedAt: '2026-04-01T10:00:00.000Z',
    })
  })
})
