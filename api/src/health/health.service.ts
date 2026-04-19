import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type DependencyHealth = {
  status: 'up' | 'down'
  details?: string
}

export type HealthResponse = {
  status: 'ok' | 'degraded'
  timestamp: string
  services: {
    api: DependencyHealth
    postgres: DependencyHealth
    redis: DependencyHealth
  }
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ])

    const status =
      postgres.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded'

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: 'up',
        },
        postgres,
        redis,
      },
    }
  }

  private async checkPostgres(): Promise<DependencyHealth> {
    try {
      await this.prismaService.$queryRawUnsafe('SELECT 1')

      return {
        status: 'up',
      }
    } catch (error) {
      return {
        status: 'down',
        details: error instanceof Error ? error.message : 'unknown error',
      }
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    try {
      const isReachable = await this.redisService.ping()

      if (isReachable) {
        return {
          status: 'up',
        }
      }

      return {
        status: 'down',
        details: 'Redis ping failed',
      }
    } catch (error) {
      return {
        status: 'down',
        details: error instanceof Error ? error.message : 'unknown error',
      }
    }
  }
}
