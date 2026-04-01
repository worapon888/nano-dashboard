import { afterEach, describe, expect, it, vi } from 'vitest'

import { getDashboardSummary } from './dashboard.service'
import { apiClient } from './api'

vi.mock('./api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

describe('getDashboardSummary', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes top mover numeric fields returned as strings', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          userCount: 3,
          topMovers: [
            {
              symbol: 'BTCUSDT',
              price: '68140.12',
              priceChange24h: '1.34',
              volume24h: '1000000',
              high24h: '69000',
              low24h: '67000',
              fetchedAt: '2026-04-01T10:00:00.000Z',
            },
          ],
          marketOverview: {
            btcDominance: 54.2,
            fearGreedIndex: 69,
          },
          marketShare: [],
          btcPriceTrend: null,
          volumeProfile: null,
          dailyPnl: null,
          openOrders: null,
          warnings: [],
        },
      },
    })

    const summary = await getDashboardSummary('token')

    expect(summary.topMovers).toEqual([
      {
        symbol: 'BTCUSDT',
        price: 68140.12,
        priceChange24h: 1.34,
        volume24h: 1000000,
        high24h: 69000,
        low24h: 67000,
        fetchedAt: '2026-04-01T10:00:00.000Z',
      },
    ])
  })
})
