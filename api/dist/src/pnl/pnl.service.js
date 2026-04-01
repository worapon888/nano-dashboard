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
var PnlService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PnlService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const DEMO_USER_EMAIL = 'admin@example.com';
const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_ORDER = [
    'Apr 1',
    'Apr 2',
    'Apr 3',
    'Apr 4',
    'Apr 5',
    'Apr 6',
    'Apr 7',
    'Apr 8',
    'Apr 9',
    'Apr 10',
    'Apr 11',
    'Apr 12',
];
const YEAR_ORDER = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];
const DEMO_WEEKLY_PNL_SERIES = [
    { day: 'Mon', value: 540 },
    { day: 'Tue', value: -220 },
    { day: 'Wed', value: 310 },
    { day: 'Thu', value: 680 },
    { day: 'Fri', value: -140 },
    { day: 'Sat', value: 190 },
    { day: 'Sun', value: 420 },
];
const DEMO_MONTHLY_PNL_SERIES = [
    { day: 'Apr 1', value: 340 },
    { day: 'Apr 2', value: -120 },
    { day: 'Apr 3', value: 270 },
    { day: 'Apr 4', value: 560 },
    { day: 'Apr 5', value: -80 },
    { day: 'Apr 6', value: 210 },
    { day: 'Apr 7', value: 420 },
    { day: 'Apr 8', value: 180 },
    { day: 'Apr 9', value: -160 },
    { day: 'Apr 10', value: 310 },
    { day: 'Apr 11', value: 470 },
    { day: 'Apr 12', value: 250 },
];
const DEMO_YEARLY_PNL_SERIES = [
    { day: 'Jan', value: 1240 },
    { day: 'Feb', value: 980 },
    { day: 'Mar', value: -430 },
    { day: 'Apr', value: 1680 },
    { day: 'May', value: 720 },
    { day: 'Jun', value: -260 },
    { day: 'Jul', value: 1140 },
    { day: 'Aug', value: 890 },
    { day: 'Sep', value: -120 },
    { day: 'Oct', value: 1360 },
    { day: 'Nov', value: 640 },
    { day: 'Dec', value: 1520 },
];
let PnlService = PnlService_1 = class PnlService {
    prisma;
    logger = new common_1.Logger(PnlService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getWeeklyPnl(userId, range = 'week') {
        try {
            const user = await this.prisma.user.findFirst({
                where: {
                    id: userId,
                    deletedAt: null,
                },
                select: {
                    email: true,
                },
            });
            if (!user) {
                return this.createEmptyWeeklyPnl(range);
            }
            if (user.email === DEMO_USER_EMAIL) {
                return this.toWeeklyPnlDto(range, this.getDemoSeries(range));
            }
            return this.createEmptyWeeklyPnl(range);
        }
        catch (error) {
            this.logger.error(`PNL load failed for user ${userId} (${range}): ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error.stack : undefined);
            return this.createEmptyWeeklyPnl(range);
        }
    }
    createEmptyWeeklyPnl(range) {
        return {
            range,
            weeklyNet: 0,
            series: [],
            stats: {
                best: 0,
                worst: 0,
                avg: 0,
                win: 0,
                loss: 0,
            },
            updatedAt: new Date().toISOString(),
        };
    }
    toWeeklyPnlDto(range, seedSeries) {
        const orderedLabels = this.getOrderedLabels(range);
        const normalizedSeries = orderedLabels.map((day) => {
            const matchedPoint = seedSeries.find((item) => item.day === day);
            return {
                day,
                value: matchedPoint?.value ?? 0,
            };
        });
        const values = normalizedSeries.map((item) => item.value);
        const weeklyNet = values.reduce((sum, value) => sum + value, 0);
        return {
            range,
            weeklyNet,
            series: normalizedSeries,
            stats: {
                best: values.length > 0 ? Math.max(...values) : 0,
                worst: values.length > 0 ? Math.min(...values) : 0,
                avg: values.length > 0
                    ? Number((weeklyNet / values.length).toFixed(2))
                    : 0,
                win: values.filter((value) => value > 0).length,
                loss: values.filter((value) => value < 0).length,
            },
            updatedAt: new Date().toISOString(),
        };
    }
    getDemoSeries(range) {
        if (range === 'month') {
            return DEMO_MONTHLY_PNL_SERIES;
        }
        if (range === 'year') {
            return DEMO_YEARLY_PNL_SERIES;
        }
        return DEMO_WEEKLY_PNL_SERIES;
    }
    getOrderedLabels(range) {
        if (range === 'month') {
            return MONTH_ORDER;
        }
        if (range === 'year') {
            return YEAR_ORDER;
        }
        return WEEKDAY_ORDER;
    }
};
exports.PnlService = PnlService;
exports.PnlService = PnlService = PnlService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PnlService);
//# sourceMappingURL=pnl.service.js.map