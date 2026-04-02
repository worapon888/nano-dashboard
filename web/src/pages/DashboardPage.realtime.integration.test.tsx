import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from './DashboardPage'
import type { DashboardSummaryData } from '../types/dashboard'
import { getDashboardSummary } from '../services/dashboard.service'
import { getAuthenticatedUser } from '../services/auth.service'

vi.mock('../services/dashboard.service', () => ({
  getDashboardSummary: vi.fn(),
}))

vi.mock('../services/auth.service', async () => {
  const actual = await vi.importActual<typeof import('../services/auth.service')>(
    '../services/auth.service',
  )

  return {
    ...actual,
    getAuthenticatedUser: vi.fn(),
  }
})

vi.mock('../shared/hooks/useResizeObserver', () => ({
  default: () => ({
    ref: vi.fn(),
    width: 1440,
    height: 900,
  }),
}))

vi.mock('react-apexcharts', () => ({
  default: ({ type }: { type: string }) => <div data-testid={`apex-chart-${type}`} />,
}))

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

const dashboardSummary: DashboardSummaryData = {
  userCount: 2,
  topMovers: [],
  marketOverview: {
    btcDominance: 52.4,
    fearGreedIndex: 68,
  },
  marketShare: [
    { symbol: 'BTC', dominance: 52.4 },
    { symbol: 'ETH', dominance: 18 },
    { symbol: 'OTHERS', dominance: 29.6 },
  ],
  btcPriceTrend: {
    range: '1h',
    currency: 'USD',
    livePrice: 67813.16,
    change24h: 1078.3,
    change24hPercent: 1.616,
    labels: ['19:00', '20:00', '21:00'],
    series: [66550.05, 66651.4, 66809.3],
    high: 67943.43,
    low: 66124.99,
    updatedAt: '2026-03-31T18:44:09.494Z',
  },
  volumeProfile: {
    timeframe: '1h',
    labels: ['19:00', '20:00', '21:00'],
    volume: [100, 120, 130],
    colors: ['#22c55e', '#ef4444', '#22c55e'],
    updatedAt: '2026-03-31T18:44:09.494Z',
  },
  dailyPnl: {
    range: 'week',
    weeklyNet: 1780,
    series: [
      { day: 'Mon', value: 540 },
      { day: 'Tue', value: -220 },
      { day: 'Wed', value: 310 },
      { day: 'Thu', value: 680 },
      { day: 'Fri', value: -140 },
      { day: 'Sat', value: 190 },
      { day: 'Sun', value: 420 },
    ],
    stats: {
      best: 680,
      worst: -220,
      avg: 254,
      win: 5,
      loss: 2,
    },
    updatedAt: '2026-03-31T18:44:09.494Z',
  },
  openOrders: {
    activeCount: 1,
    totalCount: 1,
    items: [
      {
        id: 'order-1',
        pair: 'BTC/USDT',
        side: 'BUY',
        type: 'Limit',
        price: 68420,
        amount: 0.15,
        filledPercent: 0,
        totalUsd: 10263,
        status: 'Open',
        createdAtLabel: 'Mar 31, 16:23',
      },
    ],
    updatedAt: '2026-03-31T18:45:00Z',
  },
  health: {
    db: 'unknown',
    redis: 'unknown',
    wsConnections: 0,
  },
  warnings: [],
  generatedAt: '2026-03-31T17:07:02.76Z',
}

function getBtcPriceTrendSection() {
  const heading = screen.getAllByRole('heading', { name: 'BTC Price Trend' })[0]
  const section = heading.closest('section')

  if (!section) {
    throw new Error('Could not find BTC Price Trend section')
  }

  return section
}

describe('DashboardPage realtime integration', () => {
  beforeEach(() => {
    MockSocket.reset()
    window.localStorage.setItem('accessToken', 'test-token')
    vi.mocked(getDashboardSummary).mockResolvedValue(structuredClone(dashboardSummary))
    vi.mocked(getAuthenticatedUser).mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      displayName: 'Demo User',
      role: 'ADMIN',
      isActive: true,
      createdAt: '2026-03-31T17:07:02.76Z',
    })
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('updates the visible BTC live price when a websocket price event arrives', async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(getDashboardSummary).toHaveBeenCalled()
      expect(screen.getAllByRole('heading', { name: 'BTC Price Trend' }).length).toBeGreaterThan(0)
    })

    const priceTrendSection = getBtcPriceTrendSection()
    expect(within(priceTrendSection).getByText('$67,813')).toBeTruthy()

    const socket = MockSocket.instances[0]

    socket.emitEvent('connect')
    socket.emitEvent('btc.price.updated', {
      symbol: 'BTCUSDT',
      price: 70123,
      change24h: 1500,
      change24hPercent: 2.14,
      high24h: 70500,
      low24h: 66000,
      updatedAt: '2026-04-01T09:15:00.000Z',
    })

    await waitFor(() => {
      expect(within(getBtcPriceTrendSection()).getByText('$70,123')).toBeTruthy()
    })

    expect(within(getBtcPriceTrendSection()).queryByText('$67,813')).toBeNull()
    expect(within(getBtcPriceTrendSection()).getByText('Live')).toBeTruthy()
  })
})
