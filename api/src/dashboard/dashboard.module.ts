import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { RedisModule } from '../redis/redis.module';
import { UsersModule } from '../users/users.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [UsersModule, MarketDataModule, RedisModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
