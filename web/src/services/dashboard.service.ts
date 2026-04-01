import { apiClient } from './api'
import type {
  BtcTrendRange,
  DailyPnlRange,
  DashboardTopMover,
  DashboardSummaryData,
  DashboardSummaryResponse,
} from '../types/dashboard'

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function normalizeTopMover(mover: unknown): DashboardTopMover {
  const candidate = (mover ?? {}) as Partial<DashboardTopMover> & {
    price?: number | string | null
    priceChange24h?: number | string | null
    volume24h?: number | string | null
    high24h?: number | string | null
    low24h?: number | string | null
  }

  return {
    symbol: typeof candidate.symbol === 'string' ? candidate.symbol : '',
    price: toFiniteNumber(candidate.price),
    priceChange24h: toFiniteNumber(candidate.priceChange24h),
    volume24h: toFiniteNumber(candidate.volume24h),
    high24h: toFiniteNumber(candidate.high24h),
    low24h: toFiniteNumber(candidate.low24h),
    fetchedAt: typeof candidate.fetchedAt === 'string' ? candidate.fetchedAt : '',
  }
}

function normalizeDashboardSummary(data: DashboardSummaryData): DashboardSummaryData {
  return {
    ...data,
    topMovers: Array.isArray(data.topMovers) ? data.topMovers.map(normalizeTopMover) : [],
  }
}

export async function getDashboardSummary(
  token: string,
  range: BtcTrendRange = '1h',
  volumeTf: BtcTrendRange = '1h',
  pnlRange: DailyPnlRange = 'week',
): Promise<DashboardSummaryData> {
  const response = await apiClient.get<DashboardSummaryResponse>('/dashboard/summary', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      range,
      volumeTf,
      pnlRange,
    },
  })

  return normalizeDashboardSummary(response.data.data)
}
