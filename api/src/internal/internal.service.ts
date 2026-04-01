import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { WS_CONNECTIONS_PROVIDER } from '../events/events.tokens';
import type { WsConnectionsProvider } from '../events/events.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type HealthStatus = 'up' | 'down' | 'unknown';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Optional()
    @Inject(WS_CONNECTIONS_PROVIDER)
    private readonly websocketProvider?: WsConnectionsProvider,
  ) {}

  async getQuickHealth(): Promise<{
    db: HealthStatus;
    redis: HealthStatus;
    wsConnections: number | null;
  }> {
    const [db, redis, wsConnections] = await Promise.all([
      this.getDatabaseHealth(),
      this.getRedisHealth(),
      this.getWsConnectionCount(),
    ]);

    return {
      db,
      redis,
      wsConnections,
    };
  }

  private async getDatabaseHealth(): Promise<HealthStatus> {
    if (!this.prisma) {
      return 'unknown';
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (error) {
      this.logger.warn(
        `Database health check failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return 'down';
    }
  }

  private async getRedisHealth(): Promise<HealthStatus> {
    if (!this.redisService) {
      return 'unknown';
    }

    try {
      return (await this.redisService.ping()) ? 'up' : 'down';
    } catch (error) {
      this.logger.warn(
        `Redis health check failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return 'down';
    }
  }

  private async getWsConnectionCount(): Promise<number | null> {
    if (!this.websocketProvider?.getConnectionCount) {
      return 0;
    }

    try {
      const connectionCount = await this.websocketProvider.getConnectionCount();

      return typeof connectionCount === 'number' ? connectionCount : 0;
    } catch (error) {
      this.logger.warn(
        `Websocket connection health check failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return 0;
    }
  }
}
