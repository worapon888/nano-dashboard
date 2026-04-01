import { Module } from '@nestjs/common';
import { BinanceModule } from '../binance/binance.module';
import { InternalModule } from '../internal/internal.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { OrdersModule } from '../orders/orders.module';
import { PnlModule } from '../pnl/pnl.module';
import { RedisModule } from '../redis/redis.module';
import { UsersModule } from '../users/users.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    BinanceModule,
    UsersModule,
    MarketDataModule,
    OrdersModule,
    PnlModule,
    RedisModule,
    InternalModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
