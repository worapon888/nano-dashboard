import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PnlService } from './pnl.service';

@Module({
  imports: [PrismaModule],
  providers: [PnlService],
  exports: [PnlService],
})
export class PnlModule {}
