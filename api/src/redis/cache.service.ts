import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  constructor(private readonly redisService: RedisService) {}

  async get(key: string): Promise<string | null> {
    return this.redisService.get<string>(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redisService.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redisService.del(key);
  }
}
