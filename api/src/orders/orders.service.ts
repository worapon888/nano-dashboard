import { Injectable, Logger } from '@nestjs/common';
import { OrderSide, OrderStatus, OrderType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type DashboardOpenOrderSide = 'BUY' | 'SELL';
export type DashboardOpenOrderType = 'Limit' | 'Market' | 'Stop' | 'TP';
export type DashboardOpenOrderStatus =
  | 'Open'
  | 'Partial'
  | 'Filled'
  | 'Cancelled';

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

type OrderRecord = {
  id: string;
  pair: string;
  side: OrderSide;
  type: OrderType;
  price: Prisma.Decimal | number | string;
  amount: Prisma.Decimal | number | string;
  filledPercent: Prisma.Decimal | number | string;
  totalUsd: Prisma.Decimal | number | string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
};

const DEMO_USER_EMAIL = 'admin@example.com';
const ACTIVE_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.OPEN,
  OrderStatus.PARTIAL,
]);

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly createdAtFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });

  constructor(private readonly prisma: PrismaService) {}

  async getOpenOrders(userId: string): Promise<DashboardOpenOrdersDto> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
        },
      });

      if (!user) {
        return this.createEmptyOpenOrders();
      }

      const orders = await this.prisma.order.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (user.email === DEMO_USER_EMAIL) {
        return this.toDashboardOpenOrdersDto(orders);
      }

      if (orders.length === 0) {
        return this.createEmptyOpenOrders();
      }

      return this.toDashboardOpenOrdersDto(orders);
    } catch (error) {
      this.logger.error(
        `Open orders load failed for user ${userId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      return this.createEmptyOpenOrders();
    }
  }

  private toDashboardOpenOrdersDto(
    orders: OrderRecord[],
  ): DashboardOpenOrdersDto {
    if (orders.length === 0) {
      return this.createEmptyOpenOrders();
    }

    const items = orders.map((order) => ({
      id: order.id,
      pair: order.pair,
      side: this.mapOrderSide(order.side),
      type: this.mapOrderType(order.type),
      price: this.toFiniteNumber(order.price),
      amount: this.toFiniteNumber(order.amount),
      filledPercent: this.toFiniteNumber(order.filledPercent),
      totalUsd: this.toFiniteNumber(order.totalUsd),
      status: this.mapOrderStatus(order.status),
      createdAtLabel: this.formatCreatedAtLabel(order.createdAt),
    }));

    return {
      activeCount: orders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status))
        .length,
      totalCount: items.length,
      items,
      updatedAt: this.getLatestUpdatedAt(orders),
    };
  }

  private createEmptyOpenOrders(): DashboardOpenOrdersDto {
    return {
      activeCount: 0,
      totalCount: 0,
      items: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private getLatestUpdatedAt(orders: OrderRecord[]): string {
    const latestTimestamp = Math.max(
      ...orders.map((order) => order.updatedAt.getTime()),
    );

    return new Date(latestTimestamp).toISOString();
  }

  private mapOrderSide(side: OrderSide): DashboardOpenOrderSide {
    return side === OrderSide.SELL ? 'SELL' : 'BUY';
  }

  private mapOrderType(type: OrderType): DashboardOpenOrderType {
    if (type === OrderType.MARKET) {
      return 'Market';
    }

    if (type === OrderType.STOP) {
      return 'Stop';
    }

    if (type === OrderType.TAKE_PROFIT) {
      return 'TP';
    }

    return 'Limit';
  }

  private mapOrderStatus(status: OrderStatus): DashboardOpenOrderStatus {
    if (status === OrderStatus.PARTIAL) {
      return 'Partial';
    }

    if (status === OrderStatus.FILLED) {
      return 'Filled';
    }

    if (status === OrderStatus.CANCELLED) {
      return 'Cancelled';
    }

    return 'Open';
  }

  private formatCreatedAtLabel(value: Date): string {
    return this.createdAtFormatter.format(value).replace(' at ', ', ');
  }

  private toFiniteNumber(value: Prisma.Decimal | number | string): number {
    const raw =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : value.toNumber();

    return Number.isFinite(raw) ? raw : 0;
  }
}
