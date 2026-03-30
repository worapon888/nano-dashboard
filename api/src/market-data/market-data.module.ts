import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BinanceModule } from '../binance/binance.module';
import { CacheModule } from '../cache/cache.module';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';

@Module({
  imports: [AuthModule, BinanceModule, CacheModule],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
