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
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const DEMO_USER_EMAIL = 'admin@example.com';
const ACTIVE_ORDER_STATUSES = new Set([
    client_1.OrderStatus.OPEN,
    client_1.OrderStatus.PARTIAL,
]);
let OrdersService = OrdersService_1 = class OrdersService {
    prisma;
    logger = new common_1.Logger(OrdersService_1.name);
    createdAtFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
    });
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOpenOrders(userId) {
        try {
            const user = await this.prisma.user.findFirst({
                where: {
                    id: userId,
                    deletedAt: null,
                },
                select: {
                    id: true,
                    email: true,
                },
            });
            if (!user) {
                return this.createEmptyOpenOrders();
            }
            const orders = await this.prisma.order.findMany({
                where: {
                    userId: user.id,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            if (user.email === DEMO_USER_EMAIL) {
                return this.toDashboardOpenOrdersDto(orders);
            }
            if (orders.length === 0) {
                return this.createEmptyOpenOrders();
            }
            return this.toDashboardOpenOrdersDto(orders);
        }
        catch (error) {
            this.logger.error(`Open orders load failed for user ${userId}: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error.stack : undefined);
            return this.createEmptyOpenOrders();
        }
    }
    toDashboardOpenOrdersDto(orders) {
        if (orders.length === 0) {
            return this.createEmptyOpenOrders();
        }
        const items = orders.map((order) => ({
            id: order.id,
            pair: order.pair,
            side: this.mapOrderSide(order.side),
            type: this.mapOrderType(order.type),
            price: this.toFiniteNumber(order.price),
            amount: this.toFiniteNumber(order.amount),
            filledPercent: this.toFiniteNumber(order.filledPercent),
            totalUsd: this.toFiniteNumber(order.totalUsd),
            status: this.mapOrderStatus(order.status),
            createdAtLabel: this.formatCreatedAtLabel(order.createdAt),
        }));
        return {
            activeCount: orders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status))
                .length,
            totalCount: items.length,
            items,
            updatedAt: this.getLatestUpdatedAt(orders),
        };
    }
    createEmptyOpenOrders() {
        return {
            activeCount: 0,
            totalCount: 0,
            items: [],
            updatedAt: new Date().toISOString(),
        };
    }
    getLatestUpdatedAt(orders) {
        const latestTimestamp = Math.max(...orders.map((order) => order.updatedAt.getTime()));
        return new Date(latestTimestamp).toISOString();
    }
    mapOrderSide(side) {
        return side === client_1.OrderSide.SELL ? 'SELL' : 'BUY';
    }
    mapOrderType(type) {
        if (type === client_1.OrderType.MARKET) {
            return 'Market';
        }
        if (type === client_1.OrderType.STOP) {
            return 'Stop';
        }
        if (type === client_1.OrderType.TAKE_PROFIT) {
            return 'TP';
        }
        return 'Limit';
    }
    mapOrderStatus(status) {
        if (status === client_1.OrderStatus.PARTIAL) {
            return 'Partial';
        }
        if (status === client_1.OrderStatus.FILLED) {
            return 'Filled';
        }
        if (status === client_1.OrderStatus.CANCELLED) {
            return 'Cancelled';
        }
        return 'Open';
    }
    formatCreatedAtLabel(value) {
        return this.createdAtFormatter.format(value).replace(' at ', ', ');
    }
    toFiniteNumber(value) {
        const raw = typeof value === 'number'
            ? value
            : typeof value === 'string'
                ? Number(value)
                : value.toNumber();
        return Number.isFinite(raw) ? raw : 0;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map