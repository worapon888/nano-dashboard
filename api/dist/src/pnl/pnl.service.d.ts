import { PrismaService } from '../prisma/prisma.service';
type WeeklyPnlDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
type MonthlyPnlDay = 'Apr 1' | 'Apr 2' | 'Apr 3' | 'Apr 4' | 'Apr 5' | 'Apr 6' | 'Apr 7' | 'Apr 8' | 'Apr 9' | 'Apr 10' | 'Apr 11' | 'Apr 12';
type YearlyPnlDay = 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
export type DailyPnlRange = 'week' | 'month' | 'year';
type PnlDayLabel = WeeklyPnlDay | MonthlyPnlDay | YearlyPnlDay;
export type DailyPnlPointDto = {
    day: PnlDayLabel;
    value: number;
};
export type DailyPnlStatsDto = {
    best: number;
    worst: number;
    avg: number;
    win: number;
    loss: number;
};
export type WeeklyPnlDto = {
    range: DailyPnlRange;
    weeklyNet: number;
    series: DailyPnlPointDto[];
    stats: DailyPnlStatsDto;
    updatedAt: string;
};
export declare class PnlService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getWeeklyPnl(userId: string, range?: DailyPnlRange): Promise<WeeklyPnlDto>;
    private createEmptyWeeklyPnl;
    private toWeeklyPnlDto;
    private getDemoSeries;
    private getOrderedLabels;
}
export {};
