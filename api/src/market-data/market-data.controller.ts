import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TickerDto } from './dto/ticker.dto';
import { MarketDataService } from './market-data.service';

@Controller('market')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @UseGuards(JwtAuthGuard)
  @Get('ticker/:symbol')
  async getTicker(@Param('symbol') symbol: string): Promise<TickerDto> {
    return this.marketDataService.getTicker(symbol);
  }
}
