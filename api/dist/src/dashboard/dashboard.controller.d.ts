import type { Request } from 'express';
import type { CurrentUserPayload } from '../auth/interfaces/current-user-payload.interface';
import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getSummary(req: Request & {
        user: CurrentUserPayload;
    }, range?: string, volumeTf?: string, pnlRange?: string): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: import("./dto/dashboard-summary.dto").DashboardSummaryDto;
    }>;
}
