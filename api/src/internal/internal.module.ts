import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { InternalService } from './internal.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [InternalService],
  exports: [InternalService],
})
export class InternalModule {}
