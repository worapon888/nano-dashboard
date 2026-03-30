import { Injectable } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly usersService: UsersService,
    private readonly marketDataService: MarketDataService,
    private readonly redisService: RedisService,
  ) {}

  async getSummary(userId: string) {
    const [user, btcTicker] = await Promise.all([
      this.usersService.findById(userId),
      this.marketDataService.getTicker('BTCUSDT'),
    ]);

    const summary = {
      user,
      watchlist: ['BTCUSDT'],
      market: {
        primaryTicker: btcTicker,
      },
      generatedAt: new Date().toISOString(),
    };

    await this.redisService.set(`dashboard:summary:${userId}`, summary, 15);

    return summary;
  }
}
