import { DashboardService } from './dashboard.service';

describe('DashboardService aggregated dashboard', () => {
  it('builds GET /dashboard response in parallel through services', async () => {
    const usersService = {
      getDashboardUsersSnapshot: jest.fn().mockResolvedValue({
        total: 2,
        active: 2,
        list: [
          {
            id: 'user-1',
            email: 'admin@example.com',
            displayName: 'Admin User',
            role: 'ADMIN',
            isActive: true,
            createdAt: new Date('2026-04-01T10:00:00.000Z'),
            updatedAt: new Date('2026-04-01T10:00:00.000Z'),
          },
        ],
      }),
    };
    const binanceService = {
      getPrice: jest
        .fn()
        .mockResolvedValueOnce({
          symbol: 'BTCUSDT',
          price: '68432.10',
          fetchedAt: '2026-04-01T10:00:30.000Z',
          source: 'cache',
        })
        .mockResolvedValueOnce({
          symbol: 'ETHUSDT',
          price: '3521.88',
          fetchedAt: '2026-04-01T10:00:31.000Z',
          source: 'cache',
        }),
    };

    const service = new DashboardService(
      usersService as never,
      binanceService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
    );

    await expect(service.getAggregatedDashboard()).resolves.toEqual({
      users: {
        total: 2,
        active: 2,
        list: [
          {
            id: 'user-1',
            email: 'admin@example.com',
            displayName: 'Admin User',
            role: 'ADMIN',
            isActive: true,
            createdAt: new Date('2026-04-01T10:00:00.000Z'),
            updatedAt: new Date('2026-04-01T10:00:00.000Z'),
          },
        ],
      },
      market: {
        BTCUSDT: {
          price: '68432.10',
          cachedAt: '2026-04-01T10:00:30.000Z',
        },
        ETHUSDT: {
          price: '3521.88',
          cachedAt: '2026-04-01T10:00:31.000Z',
        },
      },
    });

    expect(usersService.getDashboardUsersSnapshot).toHaveBeenCalledTimes(1);
    expect(binanceService.getPrice).toHaveBeenNthCalledWith(1, 'BTCUSDT');
    expect(binanceService.getPrice).toHaveBeenNthCalledWith(2, 'ETHUSDT');
  });
});
