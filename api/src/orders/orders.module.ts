import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrismaModule],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
