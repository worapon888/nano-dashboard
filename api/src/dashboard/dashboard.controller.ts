import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUserPayload } from '../auth/interfaces/current-user-payload.interface';
import { successResponse } from '../common/utils/api-response.util';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

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
