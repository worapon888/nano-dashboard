import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { successResponse } from '../common/utils/api-response.util';
import { MarketDataService } from './market-data.service';

@ApiTags('Market Data')
@ApiBearerAuth()
@Controller('market')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @ApiOperation({ summary: 'Get ticker data by symbol' })
  @ApiParam({ name: 'symbol', example: 'BTCUSDT' })
  @ApiResponse({
    status: 200,
    description: 'Ticker retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Ticker retrieved successfully',
        data: {
          symbol: 'BTCUSDT',
          price: '68432.10',
          volume24h: '23100.50',
          priceChange24h: '1780.00',
          priceChange24hPercent: '2.67',
          high24h: '69310.00',
          low24h: '66427.53',
          fetchedAt: '2026-04-01T10:00:30.000Z',
          source: 'binance',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get('ticker/:symbol')
  async getTicker(@Param('symbol') symbol: string) {
    const ticker = await this.marketDataService.getTicker(symbol);
    return successResponse(ticker, 'Ticker retrieved successfully');
  }
}
