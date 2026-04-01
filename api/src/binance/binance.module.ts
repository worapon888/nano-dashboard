import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '../redis/redis.module';
import { BinanceService } from './binance.service';

@Module({
  imports: [HttpModule, RedisModule, ScheduleModule.forRoot()],
  providers: [BinanceService],
  exports: [BinanceService],
})
export class BinanceModule {}
