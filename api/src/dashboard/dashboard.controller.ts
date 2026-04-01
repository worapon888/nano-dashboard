import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUserPayload } from '../auth/interfaces/current-user-payload.interface';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { successResponse } from '../common/utils/api-response.util';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({ summary: 'Get aggregated dashboard data for users and cached market prices' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated dashboard retrieved successfully',
    schema: {
      example: {
        users: {
          total: 2,
          active: 2,
          list: [
            {
              id: 'c0a8012e-d8b9-4fcf-9f75-2b0d44cc0f31',
              email: 'user@example.com',
              displayName: 'Demo User',
              role: 'USER',
              isActive: true,
              createdAt: '2026-04-01T10:00:00.000Z',
              updatedAt: '2026-04-01T10:10:00.000Z',
            },
          ],
        },
        market: {
          BTCUSDT: { price: '68432.10', cachedAt: '2026-04-01T10:00:30.000Z' },
          ETHUSDT: { price: '3521.88', cachedAt: '2026-04-01T10:00:31.000Z' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get()
  async getDashboard() {
    return this.dashboardService.getAggregatedDashboard();
  }

  @ApiOperation({ summary: 'Get the full trading dashboard summary' })
  @ApiQuery({ name: 'range', required: false, example: '1h' })
  @ApiQuery({ name: 'volumeTf', required: false, example: '1h' })
  @ApiQuery({ name: 'pnlRange', required: false, example: 'week' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Dashboard summary retrieved successfully',
        data: {
          userCount: 2,
          topMovers: [
            {
              symbol: 'BTCUSDT',
              price: '68432.10',
              volume24h: '23100.50',
              priceChange24h: '1780.00',
              high24h: '69310.00',
              low24h: '66427.53',
              fetchedAt: '2026-04-01T10:00:30.000Z',
            },
          ],
          marketOverview: { btcDominance: 52.31, fearGreedIndex: 86 },
          marketShare: [
            { symbol: 'BTC', dominance: 52.31 },
            { symbol: 'ETH', dominance: 31.2 },
            { symbol: 'OTHERS', dominance: 16.49 },
          ],
          btcPriceTrend: {
            range: '1h',
            currency: 'USD',
            livePrice: 68556,
            change24h: 1748,
            change24hPercent: 2.62,
            labels: ['10:00', '11:00', '12:00'],
            series: [68100, 68320, 68556],
            high: 69310,
            low: 66427.53,
            updatedAt: '2026-04-01T10:00:30.000Z',
          },
          volumeProfile: {
            timeframe: '1h',
            labels: ['09:00', '10:00', '11:00'],
            volume: [12000, 18000, 25582],
            colors: ['#00E6A7', '#0EA5E9', '#FACC15'],
            updatedAt: '2026-04-01T10:00:30.000Z',
          },
          dailyPnl: {
            range: 'week',
            weeklyNet: 1780,
            series: [{ day: 'Mon', value: 480 }],
            stats: { best: 820, worst: -140, avg: 255, win: 5, loss: 2 },
            updatedAt: '2026-04-01T10:00:30.000Z',
          },
          openOrders: {
            activeCount: 3,
            totalCount: 5,
            items: [
              {
                id: 'ord_001',
                pair: 'BTC/USDT',
                side: 'BUY',
                type: 'Limit',
                price: 68250,
                amount: 0.45,
                filledPercent: 62,
                totalUsd: 30712.5,
                status: 'Partial',
                createdAtLabel: 'Apr 1, 10:00',
              },
            ],
            updatedAt: '2026-04-01T10:00:30.000Z',
          },
          health: { db: 'up', redis: 'up', wsConnections: 3 },
          warnings: [],
          stale: false,
          generatedAt: '2026-04-01T10:00:30.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get('summary')
  async getSummary(
    @Req() req: Request & { user: CurrentUserPayload },
    @Query('range') range?: string,
    @Query('volumeTf') volumeTf?: string,
    @Query('pnlRange') pnlRange?: string,
  ) {
    const summary = await this.dashboardService.getSummary(
      req.user.sub,
      range,
      volumeTf,
      pnlRange,
    );
    return successResponse(summary, 'Dashboard summary retrieved successfully');
  }
}
