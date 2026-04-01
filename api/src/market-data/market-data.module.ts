import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BinanceModule } from '../binance/binance.module';
import { RedisModule } from '../redis/redis.module';
import { BtcPriceLiveService } from './btc-price-live.service';
import { BtcVolumeLiveService } from './btc-volume-live.service';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';

@Module({
  imports: [AuthModule, BinanceModule, RedisModule],
  controllers: [MarketDataController],
  providers: [MarketDataService, BtcPriceLiveService, BtcVolumeLiveService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
