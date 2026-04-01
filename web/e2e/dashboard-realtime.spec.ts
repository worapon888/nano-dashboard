import { expect, test } from '@playwright/test'

const ACCESS_TOKEN = 'playwright-test-token'

const dashboardSummary = {
  userCount: 12,
  marketOverview: {
    btcDominance: 51.73,
    fearGreedIndex: 64,
  },
  topMovers: [
    {
      symbol: 'BTCUSDT',
      price: 67813.16,
      priceChange24h: 2.14,
      volume24h: 1245000000,
      high24h: 68425.12,
      low24h: 66102.41,
      fetchedAt: '2026-03-31T18:45:00.000Z',
    },
  ],
  btcPriceTrend: {
    labels: ['09:00', '10:00', '11:00', '12:00'],
    series: [67120, 67390, 67610, 67813.16],
    livePrice: 67813.16,
    change24h: 1418.55,
    change24hPercent: 2.14,
    high: 68425.12,
    low: 66102.41,
    updatedAt: '2026-03-31T18:45:00.000Z',
  },
  volumeProfile: {
    timeframe: '1h',
    labels: ['09:00', '10:00', '11:00', '12:00'],
    volume: [180, 215, 194, 228],
    colors: ['#22c55e', '#ef4444', '#22c55e', '#22c55e'],
    updatedAt: '2026-03-31T18:45:00.000Z',
  },
  dailyPnl: {
    range: 'week',
    weeklyNet: 1730,
    series: [
      { day: 'Mon', value: 540 },
      { day: 'Tue', value: -220 },
      { day: 'Wed', value: 310 },
      { day: 'Thu', value: 680 },
      { day: 'Fri', value: -140 },
      { day: 'Sat', value: 190 },
      { day: 'Sun', value: 370 },
    ],
    stats: {
      best: 680,
      worst: -220,
      avg: 247,
      win: 5,
      loss: 2,
    },
    updatedAt: '2026-03-31T18:45:00.000Z',
  },
  openOrders: {
    activeCount: 1,
    totalCount: 1,
    items: [
      {
        id: '542482c5-03c1-476f-b508-33f381cb5029',
        pair: 'LINK/USDT',
        side: 'BUY',
        type: 'Limit',
        price: 14.25,
        amount: 100,
        filledPercent: 0,
        totalUsd: 1425,
        status: 'Open',
        createdAtLabel: 'Mar 31, 18:30',
      },
    ],
    updatedAt: '2026-03-31T18:45:00.000Z',
  },
  marketShare: [
    { symbol: 'BTC', dominance: 53.6, color: '#22c55e' },
    { symbol: 'ETH', dominance: 28.1, color: '#38bdf8' },
    { symbol: 'OTHERS', dominance: 18.3, color: '#f59e0b' },
  ],
  warnings: [],
  stale: false,
}

test.describe('Dashboard realtime websocket flow', () => {
  test('updates BTC price in the browser and keeps updating after websocket reconnect', async ({
    page,
  }) => {
    let dashboardSummaryRequests = 0

    await page.addInitScript(() => {
      type SocketMessageHandler = ((event: { data: string }) => void) | null
      type SocketState = {
        instances: MockWebSocket[]
      }

      class MockWebSocket {
        static readonly CONNECTING = 0
        static readonly OPEN = 1
        static readonly CLOSING = 2
        static readonly CLOSED = 3

        onopen: ((event: Event) => void) | null = null
        onmessage: SocketMessageHandler = null
        onerror: ((event: Event) => void) | null = null
        onclose: ((event: CloseEvent) => void) | null = null
        readyState = MockWebSocket.CONNECTING
        readonly url: string

        constructor(url: string | URL) {
          this.url = String(url)
          socketState.instances.push(this)

          window.setTimeout(() => {
            if (this.readyState !== MockWebSocket.CONNECTING) {
              return
            }

            this.readyState = MockWebSocket.OPEN
            this.onopen?.(new Event('open'))
          }, 0)
        }

        send(_data: string) {}

        close(code = 1000, reason = 'Normal Closure') {
          if (this.readyState === MockWebSocket.CLOSED) {
            return
          }

          this.readyState = MockWebSocket.CLOSED
          this.onclose?.(new CloseEvent('close', { code, reason, wasClean: true }))
        }
      }

      const socketState: SocketState = {
        instances: [],
      }

      const getLatestSocket = () => socketState.instances[socketState.instances.length - 1] ?? null

      Object.defineProperty(window, 'WebSocket', {
        configurable: true,
        writable: true,
        value: MockWebSocket,
      })

      Object.assign(window, {
        __dashboardWsTest: {
          emit(event: string, data: unknown) {
            const socket = getLatestSocket()
            if (!socket || socket.readyState !== MockWebSocket.OPEN) {
              throw new Error('No open websocket instance available for emit()')
            }

            socket.onmessage?.({ data: JSON.stringify({ event, data }) })
          },
          disconnectLatest() {
            const socket = getLatestSocket()
            if (!socket) {
              throw new Error('No websocket instance available for disconnectLatest()')
            }

            socket.close(4100, 'Test disconnect')
          },
          createdCount() {
            return socketState.instances.length
          },
          latestUrl() {
            return getLatestSocket()?.url ?? null
          },
        },
      })
    })

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            accessToken: ACCESS_TOKEN,
          },
        }),
      })
    })

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: '11111111-1111-1111-1111-111111111111',
            email: 'admin@example.com',
            displayName: 'Demo User',
            role: 'ADMIN',
            isActive: true,
            createdAt: '2026-03-30T12:00:00.000Z',
          },
        }),
      })
    })

    await page.route('**/api/dashboard/summary**', async (route) => {
      dashboardSummaryRequests += 1

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: dashboardSummary,
        }),
      })
    })

    await page.goto('/')

    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.getByTestId('auth-email-input').fill('admin@example.com')
    await page.getByTestId('auth-password-input').fill('12345678')
    await page.getByTestId('sign-in-button').click()

    await expect(page.getByTestId('widget-shell-btc-price-trend')).toBeVisible()
    await expect(page.getByTestId('btc-live-price')).toHaveText('$67,813')
    await expect(page.getByTestId('btc-live-status')).toContainText('Live')

    await page.waitForFunction(() => {
      const target = window as Window & {
        __dashboardWsTest?: { createdCount: () => number; latestUrl: () => string | null }
      }

      return (
        target.__dashboardWsTest?.createdCount() === 1 &&
        target.__dashboardWsTest.latestUrl()?.includes('token=playwright-test-token') === true
      )
    })

    expect(dashboardSummaryRequests).toBeGreaterThan(0)

    await page.evaluate(() => {
      const target = window as Window & {
        __dashboardWsTest: { emit: (event: string, data: unknown) => void }
      }

      target.__dashboardWsTest.emit('btc.price.updated', {
        symbol: 'BTCUSDT',
        price: 70123,
        change24h: 1810.12,
        change24hPercent: 2.65,
        high24h: 70610.55,
        low24h: 66102.41,
        updatedAt: '2026-03-31T18:46:00.000Z',
      })
    })

    await expect(page.getByTestId('btc-live-price')).toHaveText('$70,123')

    await page.evaluate(() => {
      const target = window as Window & {
        __dashboardWsTest: { disconnectLatest: () => void }
      }

      target.__dashboardWsTest.disconnectLatest()
    })

    await expect(page.getByTestId('btc-live-status')).toContainText('Offline')

    await page.waitForFunction(() => {
      const target = window as Window & {
        __dashboardWsTest?: { createdCount: () => number }
      }

      return target.__dashboardWsTest?.createdCount() === 2
    })

    await expect(page.getByTestId('btc-live-status')).toContainText('Live')

    await page.evaluate(() => {
      const target = window as Window & {
        __dashboardWsTest: { emit: (event: string, data: unknown) => void }
      }

      target.__dashboardWsTest.emit('btc.price.updated', {
        symbol: 'BTCUSDT',
        price: 71234,
        change24h: 1965.44,
        change24hPercent: 2.84,
        high24h: 71500.25,
        low24h: 66102.41,
        updatedAt: '2026-03-31T18:47:00.000Z',
      })
    })

    await expect(page.getByTestId('btc-live-price')).toHaveText('$71,234')
  })
})
