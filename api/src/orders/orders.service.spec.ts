import { OrderSide, OrderStatus, OrderType } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const userFindFirst = jest.fn();
  const orderFindMany = jest.fn();
  const prismaMock = {
    user: {
      findFirst: userFindFirst,
    },
    order: {
      findMany: orderFindMany,
    },
  } as any;

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(prismaMock);
  });

  it('returns seeded-style dashboard orders for the demo user', async () => {
    userFindFirst.mockResolvedValue({
      id: 'demo-user-id',
      email: 'admin@example.com',
    });
    orderFindMany.mockResolvedValue([
      {
        id: 'order-2',
        pair: 'ETH/USDT',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        price: '3480',
        amount: '2.5',
        filledPercent: '48',
        totalUsd: '8700',
        status: OrderStatus.PARTIAL,
        createdAt: new Date('2026-01-15T17:14:00.000Z'),
        updatedAt: new Date('2026-01-15T18:45:00.000Z'),
      },
      {
        id: 'order-1',
        pair: 'BTC/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: '67500',
        amount: '0.15',
        filledPercent: '0',
        totalUsd: '10125',
        status: OrderStatus.OPEN,
        createdAt: new Date('2026-01-15T16:23:00.000Z'),
        updatedAt: new Date('2026-01-15T18:45:00.000Z'),
      },
    ]);

    const result = await service.getOpenOrders('demo-user-id');

    expect(result.activeCount).toBe(2);
    expect(result.totalCount).toBe(2);
    expect(result.items).toEqual([
      {
        id: 'order-2',
        pair: 'ETH/USDT',
        side: 'SELL',
        type: 'Limit',
        price: 3480,
        amount: 2.5,
        filledPercent: 48,
        totalUsd: 8700,
        status: 'Partial',
        createdAtLabel: 'Jan 15, 17:14',
      },
      {
        id: 'order-1',
        pair: 'BTC/USDT',
        side: 'BUY',
        type: 'Limit',
        price: 67500,
        amount: 0.15,
        filledPercent: 0,
        totalUsd: 10125,
        status: 'Open',
        createdAtLabel: 'Jan 15, 16:23',
      },
    ]);
    expect(result.updatedAt).toBe('2026-01-15T18:45:00.000Z');
  });

  it('returns an empty structure for non-demo users without orders', async () => {
    userFindFirst.mockResolvedValue({
      id: 'normal-user-id',
      email: 'user@example.com',
    });
    orderFindMany.mockResolvedValue([]);

    const result = await service.getOpenOrders('normal-user-id');

    expect(result.activeCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.items).toEqual([]);
    expect(typeof result.updatedAt).toBe('string');
  });
});
