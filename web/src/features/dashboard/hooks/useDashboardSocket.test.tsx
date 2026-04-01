import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDashboardSocket } from './useDashboardSocket'

class MockWebSocket {
  static instances: MockWebSocket[] = []

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: Event) => void) | null = null
  close = vi.fn(() => {
    this.onclose?.(new Event('close'))
  })

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this)
  }

  emitOpen() {
    this.onopen?.(new Event('open'))
  }

  emitMessage(payload: unknown) {
    this.onmessage?.({
      data: JSON.stringify(payload),
    } as MessageEvent)
  }

  emitError() {
    this.onerror?.(new Event('error'))
  }

  emitClose() {
    this.onclose?.(new Event('close'))
  }

  static reset() {
    MockWebSocket.instances = []
  }
}

describe('useDashboardSocket', () => {
  const originalWebSocket = window.WebSocket

  beforeEach(() => {
    MockWebSocket.reset()
    vi.useFakeTimers()
    window.WebSocket = MockWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    vi.useRealTimers()
    window.WebSocket = originalWebSocket
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

    const socket = MockWebSocket.instances[0]

    act(() => {
      socket.emitOpen()
    })

    expect(result.current).toBe('live')

    act(() => {
      socket.emitMessage({
        event: 'user.created',
        data: {
          id: 'user-1',
          email: 'new@example.com',
          displayName: 'New User',
          role: 'USER',
          isActive: true,
          createdAt: '2026-04-01T10:00:00.000Z',
        },
      })
      socket.emitMessage({
        event: 'user.updated',
        data: {
          id: 'user-2',
          email: 'updated@example.com',
          displayName: 'Updated User',
          role: 'ADMIN',
          isActive: true,
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T10:05:00.000Z',
        },
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

    expect(socket.close).toHaveBeenCalledTimes(1)
  })

  it('reconnects once after the current socket closes and ignores stale socket close events', async () => {
    const onPriceUpdated = vi.fn()

    const { result } = renderHook(() =>
      useDashboardSocket({
        enabled: true,
        onBtcPriceUpdated: onPriceUpdated,
        onBtcVolumeUpdated: vi.fn(),
      }),
    )

    const firstSocket = MockWebSocket.instances[0]

    act(() => {
      firstSocket.emitOpen()
    })

    expect(result.current).toBe('live')

    act(() => {
      firstSocket.emitClose()
      vi.advanceTimersByTime(1000)
    })

    expect(MockWebSocket.instances).toHaveLength(2)

    const secondSocket = MockWebSocket.instances[1]

    act(() => {
      secondSocket.emitOpen()
    })

    expect(result.current).toBe('live')

    act(() => {
      firstSocket.emitClose()
      vi.advanceTimersByTime(15000)
    })

    expect(MockWebSocket.instances).toHaveLength(2)

    act(() => {
      secondSocket.emitMessage({
        event: 'btc.price.updated',
        data: {
          symbol: 'BTCUSDT',
          price: 70123,
          updatedAt: '2026-04-01T10:00:00.000Z',
        },
      })
    })

    expect(onPriceUpdated).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      price: 70123,
      updatedAt: '2026-04-01T10:00:00.000Z',
    })
  })
})
