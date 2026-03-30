"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const SALT_ROUNDS = 12;
const SEEDED_HISTORY_SOURCE = 'seed';
async function seedUsers() {
    const users = [
        {
            email: 'admin@nanodashboard.local',
            password: 'Admin123!@#',
            displayName: 'System Admin',
            role: client_1.UserRole.ADMIN,
            isActive: true,
        },
        {
            email: 'alice@nanodashboard.local',
            password: 'Alice123!@#',
            displayName: 'Alice Trader',
            role: client_1.UserRole.USER,
            isActive: true,
        },
        {
            email: 'bob@nanodashboard.local',
            password: 'Bob123!@#',
            displayName: 'Bob Analyst',
            role: client_1.UserRole.USER,
            isActive: true,
        },
    ];
    const hashedUsers = await Promise.all(users.map(async (user) => ({
        ...user,
        passwordHash: await bcrypt_1.default.hash(user.password, SALT_ROUNDS),
    })));
    await Promise.all(hashedUsers.map(({ password, ...user }) => prisma.user.upsert({
        where: { email: user.email },
        update: {
            passwordHash: user.passwordHash,
            displayName: user.displayName,
            role: user.role,
            isActive: user.isActive,
            deletedAt: null,
        },
        create: {
            email: user.email,
            passwordHash: user.passwordHash,
            displayName: user.displayName,
            role: user.role,
            isActive: user.isActive,
        },
    })));
}
function buildHistorySeries(symbol, cryptoPriceId, endTime) {
    const series = symbol === 'BTCUSDT'
        ? [
            {
                price: '68025.1200000000',
                volume24h: '2150045123.4500000000',
                priceChange24h: '-1.25340000',
                high24h: '68980.5000000000',
                low24h: '67610.8000000000',
            },
            {
                price: '68110.5400000000',
                volume24h: '2181045321.2200000000',
                priceChange24h: '-1.14020000',
                high24h: '68980.5000000000',
                low24h: '67610.8000000000',
            },
            {
                price: '67985.3300000000',
                volume24h: '2210549811.9000000000',
                priceChange24h: '-1.30950000',
                high24h: '68980.5000000000',
                low24h: '67590.2000000000',
            },
            {
                price: '68240.9900000000',
                volume24h: '2265048877.1300000000',
                priceChange24h: '-0.93410000',
                high24h: '68980.5000000000',
                low24h: '67590.2000000000',
            },
            {
                price: '68410.2500000000',
                volume24h: '2319045520.4400000000',
                priceChange24h: '-0.71520000',
                high24h: '68980.5000000000',
                low24h: '67590.2000000000',
            },
            {
                price: '68355.8700000000',
                volume24h: '2368044410.7200000000',
                priceChange24h: '-0.78210000',
                high24h: '68980.5000000000',
                low24h: '67590.2000000000',
            },
        ]
        : [
            {
                price: '3450.2200000000',
                volume24h: '1102456712.3300000000',
                priceChange24h: '-0.84560000',
                high24h: '3492.8500000000',
                low24h: '3425.1500000000',
            },
            {
                price: '3464.1800000000',
                volume24h: '1125043344.8700000000',
                priceChange24h: '-0.51230000',
                high24h: '3492.8500000000',
                low24h: '3425.1500000000',
            },
            {
                price: '3458.9100000000',
                volume24h: '1148890111.1400000000',
                priceChange24h: '-0.63420000',
                high24h: '3492.8500000000',
                low24h: '3421.8000000000',
            },
            {
                price: '3471.4300000000',
                volume24h: '1172405532.5500000000',
                priceChange24h: '-0.27850000',
                high24h: '3492.8500000000',
                low24h: '3421.8000000000',
            },
            {
                price: '3480.7600000000',
                volume24h: '1199822001.7700000000',
                priceChange24h: '-0.10540000',
                high24h: '3492.8500000000',
                low24h: '3421.8000000000',
            },
            {
                price: '3478.5500000000',
                volume24h: '1214300098.6300000000',
                priceChange24h: '-0.16390000',
                high24h: '3492.8500000000',
                low24h: '3421.8000000000',
            },
        ];
    return series.map((entry, index) => ({
        cryptoPriceId,
        symbol,
        price: entry.price,
        volume24h: entry.volume24h,
        priceChange24h: entry.priceChange24h,
        high24h: entry.high24h,
        low24h: entry.low24h,
        source: SEEDED_HISTORY_SOURCE,
        recordedAt: new Date(endTime.getTime() - (series.length - index) * 60 * 60 * 1000),
    }));
}
async function seedMarketData() {
    const now = new Date();
    const btcSnapshot = await prisma.cryptoPrice.upsert({
        where: { symbol: 'BTCUSDT' },
        update: {
            price: '68355.8700000000',
            volume24h: '2368044410.7200000000',
            priceChange24h: '-0.78210000',
            high24h: '68980.5000000000',
            low24h: '67590.2000000000',
            source: 'binance',
            fetchedAt: now,
        },
        create: {
            symbol: 'BTCUSDT',
            price: '68355.8700000000',
            volume24h: '2368044410.7200000000',
            priceChange24h: '-0.78210000',
            high24h: '68980.5000000000',
            low24h: '67590.2000000000',
            source: 'binance',
            fetchedAt: now,
        },
    });
    const ethSnapshot = await prisma.cryptoPrice.upsert({
        where: { symbol: 'ETHUSDT' },
        update: {
            price: '3478.5500000000',
            volume24h: '1214300098.6300000000',
            priceChange24h: '-0.16390000',
            high24h: '3492.8500000000',
            low24h: '3421.8000000000',
            source: 'binance',
            fetchedAt: now,
        },
        create: {
            symbol: 'ETHUSDT',
            price: '3478.5500000000',
            volume24h: '1214300098.6300000000',
            priceChange24h: '-0.16390000',
            high24h: '3492.8500000000',
            low24h: '3421.8000000000',
            source: 'binance',
            fetchedAt: now,
        },
    });
    const historyRows = [
        ...buildHistorySeries('BTCUSDT', btcSnapshot.id, now),
        ...buildHistorySeries('ETHUSDT', ethSnapshot.id, now),
    ];
    await prisma.$transaction([
        prisma.priceHistory.deleteMany({
            where: {
                symbol: { in: ['BTCUSDT', 'ETHUSDT'] },
                source: SEEDED_HISTORY_SOURCE,
            },
        }),
        prisma.priceHistory.createMany({
            data: historyRows,
        }),
    ]);
}
async function main() {
    await seedUsers();
    await seedMarketData();
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (error) => {
    console.error('Seeding failed:', error);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map