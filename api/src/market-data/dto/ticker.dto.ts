export class TickerDto {
  symbol!: string;
  price!: string;
  volume24h!: string | null;
  priceChange24h!: string | null;
  high24h!: string | null;
  low24h!: string | null;
  fetchedAt!: string;
  source!: string;
  cacheSource?: 'fresh' | 'hot' | 'stale';
  stale?: boolean;
}
