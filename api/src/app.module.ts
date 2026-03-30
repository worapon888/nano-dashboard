import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BinanceModule } from './binance/binance.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MarketDataModule } from './market-data/market-data.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    UsersModule,
    AuthModule,
    BinanceModule,
    MarketDataModule,
    DashboardModule,
  ],
})
export class AppModule {}
