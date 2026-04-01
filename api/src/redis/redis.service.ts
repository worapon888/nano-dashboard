import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;
  private isConnected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      this.logger.warn('REDIS_URL is not set. Redis features will be disabled.');
      this.client = null;
      return;
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Redis connected');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed');
    });

    this.client.on('end', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection ended');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      this.logger.warn(`Redis error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.connect();
    } catch (error) {
      this.isConnected = false;
      this.logger.warn(
        `Redis unavailable during startup: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    if (this.client.status !== 'end') {
      try {
        await this.client.quit();
      } catch (error) {
        this.logger.warn(
          `Redis shutdown failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.execute(() => this.client?.get(key) ?? Promise.resolve(null));

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
    const client = this.client;

    if (!client) {
      return;
    }

    if (ttlSeconds !== undefined) {
      await this.execute(() => client.set(key, serialized, 'EX', ttlSeconds));
      return;
    }

    await this.execute(() => client.set(key, serialized));
  }

  async del(key: string): Promise<void> {
    await this.execute(() => this.client?.del(key) ?? Promise.resolve(0));
  }

  async delByPattern(pattern: string): Promise<number> {
    const client = this.client;

    if (!client) {
      return 0;
    }

    let cursor = '0';
    let deletedCount = 0;

    do {
      const result = await this.execute<[string, string[]]>(() =>
        client.scan(cursor, 'MATCH', pattern, 'COUNT', 100),
      );

      if (!result) {
        return deletedCount;
      }

      const [nextCursor, keys] = result;
      cursor = nextCursor;

      if (keys.length > 0) {
        const deleted = await this.execute(() => client.del(...keys));
        deletedCount += deleted ?? 0;
      }
    } while (cursor !== '0');

    return deletedCount;
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.execute(
      () => this.client?.set(key, value, 'EX', ttlSeconds, 'NX') ?? Promise.resolve(null),
    );
    return result === 'OK';
  }

  async ttl(key: string): Promise<number> {
    const ttl = await this.execute(() => this.client?.ttl(key) ?? Promise.resolve(-2));
    return ttl ?? -2;
  }

  async publish(channel: string, message: unknown): Promise<number> {
    const payload =
      typeof message === 'string' ? message : JSON.stringify(message);
    const published = await this.execute(
      () => this.client?.publish(channel, payload) ?? Promise.resolve(0),
    );
    return published ?? 0;
  }

  async subscribeOnce<T>(channel: string, timeoutMs: number): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    const subscriber = this.client.duplicate({
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    subscriber.on('error', (error) => {
      this.logger.warn(`Redis subscriber error: ${error.message}`);
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

  getClient(): Redis | null {
    return this.client;
  }

  async ping(): Promise<boolean> {
    const response = await this.execute(
      () => this.client?.ping() ?? Promise.resolve(null),
    );
    return response === 'PONG';
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    try {
      return await operation();
    } catch (error) {
      this.isConnected = false;
      this.logger.warn(
        `Redis operation failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }
}
