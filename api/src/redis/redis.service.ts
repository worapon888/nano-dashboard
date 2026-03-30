import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL is not set');
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);

    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds !== undefined) {
      await this.client.set(key, serialized, 'EX', ttlSeconds);
      return;
    }

    await this.client.set(key, serialized);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async publish(channel: string, message: unknown): Promise<number> {
    const payload =
      typeof message === 'string' ? message : JSON.stringify(message);
    return this.client.publish(channel, payload);
  }

  async subscribeOnce<T>(channel: string, timeoutMs: number): Promise<T | null> {
    const subscriber = this.client.duplicate({
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      await subscriber.connect();

      return await new Promise<T | null>((resolve, reject) => {
        const cleanup = async () => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }

          subscriber.removeAllListeners('message');
          subscriber.removeAllListeners('error');

          try {
            await subscriber.unsubscribe(channel);
          } catch {
            // Ignore unsubscribe errors during cleanup.
          }

          if (subscriber.status !== 'end') {
            await subscriber.quit();
          }
        };

        const settle = (value: T | null, error?: unknown) => {
          void cleanup()
            .then(() => {
              if (error) {
                reject(error);
                return;
              }

              resolve(value);
            })
            .catch(reject);
        };

        subscriber.once('error', (error) => {
          settle(null, error);
        });

        subscriber.on('message', (receivedChannel, payload) => {
          if (receivedChannel !== channel) {
            return;
          }

          try {
            settle(JSON.parse(payload) as T);
          } catch {
            settle(payload as T);
          }
        });

        timeoutHandle = setTimeout(() => {
          settle(null);
        }, timeoutMs);

        subscriber.subscribe(channel).catch((error: unknown) => {
          settle(null, error);
        });
      });
    } catch (error) {
      if (subscriber.status !== 'end') {
        await subscriber.quit();
      }

      throw error;
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
