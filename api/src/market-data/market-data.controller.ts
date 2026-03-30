import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { successResponse } from '../common/utils/api-response.util';
import { MarketDataService } from './market-data.service';

@Controller('market')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @UseGuards(JwtAuthGuard)
  @Get('ticker/:symbol')
  async getTicker(@Param('symbol') symbol: string) {
    const ticker = await this.marketDataService.getTicker(symbol);
    return successResponse(ticker, 'Ticker retrieved successfully');
  }
}
