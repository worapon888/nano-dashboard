import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DashboardWorkspace from './DashboardPage'
import type { DashboardSummaryData } from '../../../types/dashboard'

vi.mock('../../../shared/hooks/useResizeObserver', () => ({
  default: () => ({
    ref: vi.fn(),
    width: 1440,
    height: 900,
  }),
}))

vi.mock('react-apexcharts', () => ({
  default: ({ type }: { type: string }) => <div data-testid={`apex-chart-${type}`} />,
}))

const dashboardSummary: DashboardSummaryData = {
  userCount: null,
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

describe('MarketShare Breakdown render path', () => {
  it('renders the visible pie chart instead of the empty state when backend marketShare exists', async () => {
    render(
    <DashboardWorkspace
      currentUser={{
        id: 'user-1',
        email: 'admin@example.com',
        displayName: 'Demo User',
        role: 'ADMIN',
        isActive: true,
        createdAt: '2026-03-31T17:07:02.76Z',
      }}
      data={dashboardSummary}
      loading={false}
      error={null}
      realtimeNotice={null}
      btcTrendRange="1h"
      btcLiveStatus="live"
      onBtcTrendRangeChange={() => undefined}
      dailyPnlRange="week"
      onDailyPnlRangeChange={() => undefined}
      onLogout={() => undefined}
      onRefresh={() => undefined}
    />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('apex-chart-pie')).toBeTruthy()
    })

    expect(screen.queryByText('No chart data')).toBeNull()
  })

  it('renders the Open Orders widget from backend summary.openOrders data', async () => {
    render(
      <DashboardWorkspace
        currentUser={{
          id: 'user-1',
          email: 'admin@example.com',
          displayName: 'Demo User',
          role: 'ADMIN',
          isActive: true,
          createdAt: '2026-03-31T17:07:02.76Z',
        }}
        data={dashboardSummary}
        loading={false}
        error={null}
        realtimeNotice={null}
        btcTrendRange="1h"
        btcLiveStatus="live"
        onBtcTrendRangeChange={() => undefined}
        dailyPnlRange="week"
        onDailyPnlRangeChange={() => undefined}
        onLogout={() => undefined}
        onRefresh={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Open Orders' }).length).toBeGreaterThan(0)
    })

    const openOrdersHeading = screen.getAllByRole('heading', { name: 'Open Orders' })[0]
    const openOrdersSection = openOrdersHeading.closest('section')

    if (!openOrdersSection) {
      throw new Error('Could not find Open Orders section')
    }

    expect(within(openOrdersSection).getByText('1 active · 1 total')).toBeTruthy()
    expect(within(openOrdersSection).getByText('BTC/USDT')).toBeTruthy()
    expect(within(openOrdersSection).getByText('BUY')).toBeTruthy()
    expect(within(openOrdersSection).getByText('Limit')).toBeTruthy()
    expect(within(openOrdersSection).getByText('Open')).toBeTruthy()
    expect(within(openOrdersSection).getByText('Mar 31, 16:23')).toBeTruthy()
    expect(openOrdersSection.textContent).toContain('Updated')
  })
})
