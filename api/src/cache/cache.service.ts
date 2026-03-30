import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CacheService {
  constructor(private readonly redisService: RedisService) {}

  get<T>(key: string): Promise<T | null> {
    return this.redisService.get<T>(key);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redisService.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redisService.del(key);
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    await this.redisService.publish(channel, payload);
  }

  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    return this.redisService.setNx(key, value, ttlSeconds);
  }

  subscribeOnce<T>(channel: string, timeoutMs: number): Promise<T | null> {
    return this.redisService.subscribeOnce<T>(channel, timeoutMs);
  }
}
