import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly client;
    constructor();
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
    ttl(key: string): Promise<number>;
    publish(channel: string, message: unknown): Promise<number>;
    subscribeOnce<T>(channel: string, timeoutMs: number): Promise<T | null>;
}
