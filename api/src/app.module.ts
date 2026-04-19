import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BinanceModule } from './binance/binance.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { MarketDataModule } from './market-data/market-data.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    // EventsModule is @Global — importing it here makes its publisher tokens available
    // to every other module without explicit re-imports.
    EventsModule,
    HealthModule,
    UsersModule,
    AuthModule,
    BinanceModule,
    MarketDataModule,
    OrdersModule,
    DashboardModule,
  ],
})
export class AppModule {}
