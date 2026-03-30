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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
let RedisService = class RedisService {
    client;
    constructor() {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            throw new Error('REDIS_URL is not set');
        }
        this.client = new ioredis_1.default(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null,
        });
    }
    async onModuleInit() {
        await this.client.connect();
    }
    async onModuleDestroy() {
        if (this.client.status !== 'end') {
            await this.client.quit();
        }
    }
    async get(key) {
        const value = await this.client.get(key);
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
        if (ttlSeconds !== undefined) {
            await this.client.set(key, serialized, 'EX', ttlSeconds);
            return;
        }
        await this.client.set(key, serialized);
    }
    async del(key) {
        await this.client.del(key);
    }
    async setNx(key, value, ttlSeconds) {
        const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
        return result === 'OK';
    }
    async ttl(key) {
        return this.client.ttl(key);
    }
    async publish(channel, message) {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        return this.client.publish(channel, payload);
    }
    async subscribeOnce(channel, timeoutMs) {
        const subscriber = this.client.duplicate({
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null,
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
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RedisService);
//# sourceMappingURL=redis.service.js.map