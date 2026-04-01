import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private readonly client;
    private isConnected;
    constructor();
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    delByPattern(pattern: string): Promise<number>;
    setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
    ttl(key: string): Promise<number>;
    publish(channel: string, message: unknown): Promise<number>;
    subscribeOnce<T>(channel: string, timeoutMs: number): Promise<T | null>;
    getClient(): Redis | null;
    ping(): Promise<boolean>;
    isReady(): boolean;
    private execute;
}
