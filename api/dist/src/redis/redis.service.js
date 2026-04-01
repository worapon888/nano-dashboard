"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
let RedisService = RedisService_1 = class RedisService {
    logger = new common_1.Logger(RedisService_1.name);
    client;
    isConnected = false;
    constructor() {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            this.logger.warn('REDIS_URL is not set. Redis features will be disabled.');
            this.client = null;
            return;
        }
        this.client = new ioredis_1.default(redisUrl, {
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
    async onModuleInit() {
        if (!this.client) {
            return;
        }
        try {
            await this.client.connect();
        }
        catch (error) {
            this.isConnected = false;
            this.logger.warn(`Redis unavailable during startup: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
    async onModuleDestroy() {
        if (!this.client) {
            return;
        }
        if (this.client.status !== 'end') {
            try {
                await this.client.quit();
            }
            catch (error) {
                this.logger.warn(`Redis shutdown failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            }
        }
    }
    async get(key) {
        const value = await this.execute(() => this.client?.get(key) ?? Promise.resolve(null));
        if (value === null) {
            return null;
        }
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    async set(key, value, ttlSeconds) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
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
    async del(key) {
        await this.execute(() => this.client?.del(key) ?? Promise.resolve(0));
    }
    async delByPattern(pattern) {
        const client = this.client;
        if (!client) {
            return 0;
        }
        let cursor = '0';
        let deletedCount = 0;
        do {
            const result = await this.execute(() => client.scan(cursor, 'MATCH', pattern, 'COUNT', 100));
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
    async setNx(key, value, ttlSeconds) {
        const result = await this.execute(() => this.client?.set(key, value, 'EX', ttlSeconds, 'NX') ?? Promise.resolve(null));
        return result === 'OK';
    }
    async ttl(key) {
        const ttl = await this.execute(() => this.client?.ttl(key) ?? Promise.resolve(-2));
        return ttl ?? -2;
    }
    async publish(channel, message) {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        const published = await this.execute(() => this.client?.publish(channel, payload) ?? Promise.resolve(0));
        return published ?? 0;
    }
    async subscribeOnce(channel, timeoutMs) {
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
        let timeoutHandle;
        try {
            await subscriber.connect();
            return await new Promise((resolve, reject) => {
                const cleanup = async () => {
                    if (timeoutHandle) {
                        clearTimeout(timeoutHandle);
                    }
                    subscriber.removeAllListeners('message');
                    subscriber.removeAllListeners('error');
                    try {
                        await subscriber.unsubscribe(channel);
                    }
                    catch {
                    }
                    if (subscriber.status !== 'end') {
                        await subscriber.quit();
                    }
                };
                const settle = (value, error) => {
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
                        settle(JSON.parse(payload));
                    }
                    catch {
                        settle(payload);
                    }
                });
                timeoutHandle = setTimeout(() => {
                    settle(null);
                }, timeoutMs);
                subscriber.subscribe(channel).catch((error) => {
                    settle(null, error);
                });
            });
        }
        catch (error) {
            if (subscriber.status !== 'end') {
                await subscriber.quit();
            }
            throw error;
        }
    }
    getClient() {
        return this.client;
    }
    async ping() {
        const response = await this.execute(() => this.client?.ping() ?? Promise.resolve(null));
        return response === 'PONG';
    }
    isReady() {
        return this.isConnected && this.client !== null;
    }
    async execute(operation) {
        if (!this.client) {
            return null;
        }
        try {
            return await operation();
        }
        catch (error) {
            this.isConnected = false;
            this.logger.warn(`Redis operation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            return null;
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RedisService);
//# sourceMappingURL=redis.service.js.map