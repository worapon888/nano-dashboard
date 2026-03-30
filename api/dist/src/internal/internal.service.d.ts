import type { WsConnectionsProvider } from '../events/events.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
type HealthStatus = 'up' | 'down' | 'unknown';
export declare class InternalService {
    private readonly prisma;
    private readonly redisService;
    private readonly websocketProvider?;
    private readonly logger;
    constructor(prisma: PrismaService, redisService: RedisService, websocketProvider?: WsConnectionsProvider | undefined);
    getQuickHealth(): Promise<{
        db: HealthStatus;
        redis: HealthStatus;
        wsConnections: number | null;
    }>;
    private getDatabaseHealth;
    private getRedisHealth;
    private getWsConnectionCount;
}
export {};
