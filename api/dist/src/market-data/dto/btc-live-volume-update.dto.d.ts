export type BtcLiveVolumeUpdateDto = {
    symbol: 'BTCUSDT';
    timeframe: '15m' | '1h' | '4h' | '1d';
    label: string;
    volume: number;
    color: string;
    direction: 'bullish' | 'bearish';
    updatedAt: string;
};
