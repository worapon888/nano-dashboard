export type BtcLivePriceUpdateDto = {
    symbol: 'BTCUSDT';
    price: number;
    change24h?: number;
    change24hPercent?: number;
    high24h?: number;
    low24h?: number;
    updatedAt: string;
};
