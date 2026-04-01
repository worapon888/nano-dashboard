import { PrismaService } from '../prisma/prisma.service';
export type DashboardOpenOrderSide = 'BUY' | 'SELL';
export type DashboardOpenOrderType = 'Limit' | 'Market' | 'Stop' | 'TP';
export type DashboardOpenOrderStatus = 'Open' | 'Partial' | 'Filled' | 'Cancelled';
export type DashboardOpenOrderItem = {
    id: string;
    pair: string;
    side: DashboardOpenOrderSide;
    type: DashboardOpenOrderType;
    price: number;
    amount: number;
    filledPercent: number;
    totalUsd: number;
    status: DashboardOpenOrderStatus;
    createdAtLabel: string;
};
export type DashboardOpenOrdersDto = {
    activeCount: number;
    totalCount: number;
    items: DashboardOpenOrderItem[];
    updatedAt: string;
};
export declare class OrdersService {
    private readonly prisma;
    private readonly logger;
    private readonly createdAtFormatter;
    constructor(prisma: PrismaService);
    getOpenOrders(userId: string): Promise<DashboardOpenOrdersDto>;
    private toDashboardOpenOrdersDto;
    private createEmptyOpenOrders;
    private getLatestUpdatedAt;
    private mapOrderSide;
    private mapOrderType;
    private mapOrderStatus;
    private formatCreatedAtLabel;
    private toFiniteNumber;
}
