import { ServiceUnavailableException } from '@nestjs/common';
import { BinanceKlineResponse } from '../binance/binance.service';
import { BtcLivePriceUpdateDto } from './dto/btc-live-price-update.dto';
import { TickerDto } from './dto/ticker.dto';

export type DashboardTickerDto = {
  symbol: string;
  price: string;
  volume24h: string | null;
  priceChange24h: string | null;
  high24h: string | null;
  low24h: string | null;
  fetchedAt: string;
};

export type BtcPriceTrendRange = 'day' | 'week' | 'month';

export type BtcPriceTrendDto = {
  range: BtcPriceTrendRange;
  currency: 'USD';
  livePrice: number;
  change24h: number;
  change24hPercent: number;
  labels: string[];
  series: number[];
  high: number;
  low: number;
  updatedAt: string;
};

export type DashboardBtcPriceTrendSnapshot = {
  range: '15m' | '1h' | '4h' | '1d';
  currency: 'USD';
  livePrice: number;
  change24h: number;
  change24hPercent: number;
  labels: string[];
  series: number[];
  high: number;
  low: number;
  updatedAt: string;
};

export type DashboardVolumeProfileSnapshot = {
  timeframe: '15m' | '1h' | '4h' | '1d';
  labels: string[];
  volume: number[];
  colors: string[];
  updatedAt: string;
};

export type DashboardMarketOverviewSnapshot = {
  btcDominance: number;
  fearGreedIndex: number;
};

export type DashboardMarketShareSnapshot = {
  symbol: string;
  dominance: number;
};

export type DashboardMarketCompositionSnapshot = {
  marketOverview: DashboardMarketOverviewSnapshot;
  marketShare: DashboardMarketShareSnapshot[];
};

const VOLUME_BULLISH_COLOR = '#22c55e';
const VOLUME_BEARISH_COLOR = '#ef4444';

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function getHotCacheKey(symbol: string): string {
  return `app:ticker:${symbol}:hot`;
}

export function getStaleCacheKey(symbol: string): string {
  return `app:ticker:${symbol}:stale`;
}

export function getLockKey(symbol: string): string {
  return `app:lock:ticker:${symbol}`;
}

export function getChannelKey(symbol: string): string {
  return `app:ch:ticker:${symbol}`;
}

export function toFiniteNumber(
  value: string | number | null | undefined,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;

  return Number.isFinite(parsed) ? parsed : 0;
}

export function toPercentage(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

export function clampIndex(value: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.max(0, Math.min(100, value));
}

export function toDashboardTickerDto(ticker: TickerDto): DashboardTickerDto {
  return {
    symbol: ticker.symbol,
    price: ticker.price,
    volume24h: ticker.volume24h ?? null,
    priceChange24h: ticker.priceChange24h ?? null,
    high24h: ticker.high24h ?? null,
    low24h: ticker.low24h ?? null,
    fetchedAt: ticker.fetchedAt,
  };
}

export function toBtcPriceTrendDto(
  range: BtcPriceTrendRange,
  ticker: TickerDto,
  klines: BinanceKlineResponse[],
): BtcPriceTrendDto {
  const points = klines
    .map((kline) => {
      const timestamp = Number(kline[0]);
      const closePrice = Number(kline[4]);

      if (!Number.isFinite(timestamp) || !Number.isFinite(closePrice)) {
        return null;
      }

      return {
        label: formatTrendLabel(timestamp, range),
        closePrice,
      };
    })
    .filter(
      (
        point,
      ): point is {
        label: string;
        closePrice: number;
      } => point !== null,
    );

  const series = points.map((point) => point.closePrice);
  const labels = points.map((point) => point.label);
  const high = series.length > 0 ? Math.max(...series) : 0;
  const low = series.length > 0 ? Math.min(...series) : 0;

  return {
    range,
    currency: 'USD',
    livePrice: toFiniteNumber(ticker.price),
    change24h: toFiniteNumber(ticker.priceChange24h),
    change24hPercent: toFiniteNumber(ticker.priceChange24hPercent),
    labels,
    series,
    high,
    low,
    updatedAt: ticker.fetchedAt,
  };
}

export function buildDashboardMarketComposition(
  tickers: DashboardTickerDto[],
): DashboardMarketCompositionSnapshot {
  const normalizedTickers = tickers
    .map((ticker) => {
      const price = toFiniteNumber(ticker.price);
      const volume24h = toFiniteNumber(ticker.volume24h);

      return {
        symbol: ticker.symbol,
        price,
        volume24h,
        turnover: price > 0 && volume24h > 0 ? price * volume24h : 0,
        priceChangeRatio:
          price > 0 ? toFiniteNumber(ticker.priceChange24h) / price : 0,
      };
    })
    .filter((ticker) => ticker.symbol.length > 0);

  const totalTurnover = normalizedTickers.reduce(
    (sum, ticker) => sum + ticker.turnover,
    0,
  );
  const btcTicker = normalizedTickers.find((ticker) => ticker.symbol === 'BTCUSDT');

  if (!btcTicker || totalTurnover <= 0) {
    throw new ServiceUnavailableException(
      'Market overview is temporarily unavailable',
    );
  }

  const ethTurnover =
    normalizedTickers.find((ticker) => ticker.symbol === 'ETHUSDT')?.turnover ?? 0;
  const btcDominance = toPercentage((btcTicker.turnover / totalTurnover) * 100);
  const ethDominance = toPercentage((ethTurnover / totalTurnover) * 100);
  const othersDominance = toPercentage(
    Math.max(0, 100 - btcDominance - ethDominance),
  );
  const positiveBreadthRatio =
    normalizedTickers.length > 0
      ? normalizedTickers.filter((ticker) => ticker.priceChangeRatio > 0).length /
        normalizedTickers.length
      : 0.5;
  const btcMomentumPercent = btcTicker.priceChangeRatio * 100;
  const fearGreedIndex = clampIndex(
    Math.round(50 + btcMomentumPercent * 6 + (positiveBreadthRatio - 0.5) * 40),
  );

  return {
    marketOverview: {
      btcDominance,
      fearGreedIndex,
    },
    marketShare: [
      { symbol: 'BTC', dominance: btcDominance },
      { symbol: 'ETH', dominance: ethDominance },
      { symbol: 'OTHERS', dominance: othersDominance },
    ],
  };
}

export function toBtcLivePriceUpdate(
  trackedSymbol: string,
  btcTrendSymbol: 'BTCUSDT',
  ticker: TickerDto,
): BtcLivePriceUpdateDto | null {
  if (trackedSymbol !== btcTrendSymbol) {
    return null;
  }

  return {
    symbol: btcTrendSymbol,
    price: toFiniteNumber(ticker.price),
    change24h: toFiniteNumber(ticker.priceChange24h),
    change24hPercent: toFiniteNumber(ticker.priceChange24hPercent),
    high24h: toFiniteNumber(ticker.high24h),
    low24h: toFiniteNumber(ticker.low24h),
    updatedAt:
      typeof ticker.fetchedAt === 'string' && ticker.fetchedAt.length > 0
        ? ticker.fetchedAt
        : new Date().toISOString(),
  };
}

export function toDashboardBtcPriceTrendDto(
  range: DashboardBtcPriceTrendSnapshot['range'],
  ticker: {
    price: string | number | null;
    priceChange24h: string | number | null;
    priceChange24hPercent: string | number | null;
    fetchedAt: string | Date | null;
  },
  klines: BinanceKlineResponse[],
): DashboardBtcPriceTrendSnapshot {
  const points = klines
    .map((kline) => {
      const openTime = Number(kline[0]);
      const closePrice = Number(kline[4]);

      if (!Number.isFinite(openTime) || !Number.isFinite(closePrice)) {
        return null;
      }

      return {
        label: formatDashboardTrendLabel(openTime, range),
        closePrice,
      };
    })
    .filter(
      (
        point,
      ): point is {
        label: string;
        closePrice: number;
      } => point !== null,
    );

  const labels = points.map((point) => point.label);
  const series = points.map((point) => point.closePrice);

  if (labels.length === 0 || series.length === 0) {
    throw new ServiceUnavailableException(
      `BTC price trend returned no usable points for ${range}`,
    );
  }

  return {
    range,
    currency: 'USD',
    livePrice: toFiniteNumber(ticker.price),
    change24h: toFiniteNumber(ticker.priceChange24h),
    change24hPercent: toFiniteNumber(ticker.priceChange24hPercent),
    labels,
    series,
    high: Math.max(...series),
    low: Math.min(...series),
    updatedAt:
      typeof ticker.fetchedAt === 'string'
        ? ticker.fetchedAt
        : new Date().toISOString(),
  };
}

export function toDashboardVolumeProfileDto(
  timeframe: DashboardVolumeProfileSnapshot['timeframe'],
  klines: BinanceKlineResponse[],
): DashboardVolumeProfileSnapshot {
  const points = klines
    .map((kline) => {
      const openTime = Number(kline[0]);
      const open = Number(kline[1]);
      const close = Number(kline[4]);
      const volume = Number(kline[5]);

      if (
        !Number.isFinite(openTime) ||
        !Number.isFinite(open) ||
        !Number.isFinite(close) ||
        !Number.isFinite(volume)
      ) {
        return null;
      }

      return {
        label: formatDashboardVolumeLabel(openTime, timeframe),
        volume,
        color: close >= open ? VOLUME_BULLISH_COLOR : VOLUME_BEARISH_COLOR,
        updatedAt: new Date(Number(kline[6])).toISOString(),
      };
    })
    .filter(
      (
        point,
      ): point is {
        label: string;
        volume: number;
        color: string;
        updatedAt: string;
      } => point !== null,
    );

  return {
    timeframe,
    labels: points.map((point) => point.label),
    volume: points.map((point) => point.volume),
    colors: points.map((point) => point.color),
    updatedAt:
      points.length > 0
        ? points[points.length - 1].updatedAt
        : new Date().toISOString(),
  };
}

function formatTrendLabel(
  timestamp: number,
  range: BtcPriceTrendRange,
): string {
  const date = new Date(timestamp);

  if (range === 'day') {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatDashboardTrendLabel(
  timestamp: number,
  range: DashboardBtcPriceTrendSnapshot['range'],
): string {
  const date = new Date(timestamp);

  if (range === '15m' || range === '1h') {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatDashboardVolumeLabel(
  timestamp: number,
  timeframe: DashboardVolumeProfileSnapshot['timeframe'],
): string {
  const date = new Date(timestamp);

  if (timeframe === '15m' || timeframe === '1h') {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
