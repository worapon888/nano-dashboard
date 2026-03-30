import { RedisService } from '../redis/redis.service';
export declare class CacheService {
    private readonly redisService;
    constructor(redisService: RedisService);
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
    del(key: string): Promise<void>;
    publish(channel: string, payload: unknown): Promise<void>;
    setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
    subscribeOnce<T>(channel: string, timeoutMs: number): Promise<T | null>;
}
