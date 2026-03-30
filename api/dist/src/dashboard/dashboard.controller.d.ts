import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getSummary(): Promise<{
        meta?: Record<string, any> | undefined;
        success: boolean;
        message: string;
        data: import("./dto/dashboard-summary.dto").DashboardSummaryDto;
    }>;
}
