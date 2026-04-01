import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  OrderSide,
  OrderStatus,
  OrderType,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SEEDED_HISTORY_SOURCE = 'seed';
const DEMO_USER_EMAIL = 'admin@example.com';
const DEMO_PASSWORD_HASH =
  '$2b$12$kS0IXXRs2YNFm62wrnBkpOFA1StCgh.Wt/iU7h5JAXS6yG.8yIsAC';

const DEMO_USER = {
  email: DEMO_USER_EMAIL,
  passwordHash: DEMO_PASSWORD_HASH,
  displayName: 'Demo User',
  role: UserRole.ADMIN,
  isActive: true,
} as const;

const DECIMAL_SCALE = 10;

type DemoOrderSeed = {
  pair: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  amount: number;
  filledPercent: number;
  status: OrderStatus;
  createdAt: Date;
};

function decimal(value: number | string) {
  return new Prisma.Decimal(value);
}

function toMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(DECIMAL_SCALE);
}

function buildDemoOrder(
  seed: DemoOrderSeed,
): {
  pair: string;
  side: OrderSide;
  type: OrderType;
  price: Prisma.Decimal;
  amount: Prisma.Decimal;
  filledPercent: Prisma.Decimal;
  totalUsd: Prisma.Decimal;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
} {
  const price = decimal(seed.price);
  const amount = decimal(seed.amount);
  const totalUsd = toMoney(price.mul(amount));

  return {
    pair: seed.pair,
    side: seed.side,
    type: seed.type,
    price,
    amount,
    filledPercent: decimal(seed.filledPercent).toDecimalPlaces(2),
    totalUsd,
    status: seed.status,
    createdAt: seed.createdAt,
    updatedAt: new Date(seed.createdAt.getTime() + 15 * 60 * 1000),
  };
}

const DEMO_OPEN_ORDERS = [
  buildDemoOrder({
    pair: 'BTC/USDT',
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    price: 68420,
    amount: 0.15,
    filledPercent: 0,
    status: OrderStatus.OPEN,
    createdAt: new Date('2026-03-31T16:23:00.000Z'),
  }),
  buildDemoOrder({
    pair: 'ETH/USDT',
    side: OrderSide.SELL,
    type: OrderType.LIMIT,
    price: 3480,
    amount: 2.5,
    filledPercent: 48,
    status: OrderStatus.PARTIAL,
    createdAt: new Date('2026-03-31T17:14:00.000Z'),
  }),
  buildDemoOrder({
    pair: 'SOL/USDT',
    side: OrderSide.BUY,
    type: OrderType.STOP,
    price: 188.5,
    amount: 12,
    filledPercent: 0,
    status: OrderStatus.OPEN,
    createdAt: new Date('2026-03-31T17:45:00.000Z'),
  }),
  buildDemoOrder({
    pair: 'BNB/USDT',
    side: OrderSide.SELL,
    type: OrderType.TAKE_PROFIT,
    price: 420,
    amount: 8,
    filledPercent: 100,
    status: OrderStatus.FILLED,
    createdAt: new Date('2026-03-30T15:30:00.000Z'),
  }),
  buildDemoOrder({
    pair: 'XRP/USDT',
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    price: 0.624,
    amount: 5000,
    filledPercent: 0,
    status: OrderStatus.CANCELLED,
    createdAt: new Date('2026-03-30T14:15:00.000Z'),
  }),
  buildDemoOrder({
    pair: 'AVAX/USDT',
    side: OrderSide.BUY,
    type: OrderType.MARKET,
    price: 36.44,
    amount: 50,
    filledPercent: 100,
    status: OrderStatus.FILLED,
    createdAt: new Date('2026-03-31T18:00:00.000Z'),
  }),
  buildDemoOrder({
    pair: 'MATIC/USDT',
    side: OrderSide.SELL,
    type: OrderType.LIMIT,
    price: 1.145,
    amount: 3000,
    filledPercent: 26.7,
    status: OrderStatus.PARTIAL,
    createdAt: new Date('2026-03-29T16:55:00.000Z'),
  }),
  buildDemoOrder({
    pair: 'LINK/USDT',
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    price: 14.25,
    amount: 100,
    filledPercent: 0,
    status: OrderStatus.OPEN,
    createdAt: new Date('2026-03-31T18:30:00.000Z'),
  }),
] as const;

function buildHistorySeries(
  symbol: 'BTCUSDT' | 'ETHUSDT',
  cryptoPriceId: string,
  endTime: Date,
) {
  const series =
    symbol === 'BTCUSDT'
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
    recordedAt: new Date(
      endTime.getTime() - (series.length - index) * 60 * 60 * 1000,
    ),
  }));
}

async function seedDemoUser() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: {
      passwordHash: DEMO_USER.passwordHash,
      displayName: DEMO_USER.displayName,
      role: DEMO_USER.role,
      isActive: DEMO_USER.isActive,
      deletedAt: null,
    },
    create: {
      email: DEMO_USER.email,
      passwordHash: DEMO_USER.passwordHash,
      displayName: DEMO_USER.displayName,
      role: DEMO_USER.role,
      isActive: DEMO_USER.isActive,
    },
  });

  console.info(`[seed] demo user ready: ${user.email} (${user.id})`);
  return user;
}

async function seedDemoOpenOrders(userId: string) {
  await prisma.order.deleteMany({
    where: { userId },
  });

  const result = await prisma.order.createMany({
    data: DEMO_OPEN_ORDERS.map((order) => ({
      userId,
      pair: order.pair,
      side: order.side,
      type: order.type,
      price: order.price,
      amount: order.amount,
      filledPercent: order.filledPercent,
      totalUsd: order.totalUsd,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    })),
  });

  console.info(`[seed] demo open orders inserted: ${result.count}`);
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

  console.info('[seed] market snapshots and history refreshed');
}

async function seedDailyPnl() {
  console.info(
    '[seed] daily pnl skipped: no Prisma PnL model configured; dashboard uses service-level demo pnl data',
  );
}

async function main() {
  const demoUser = await seedDemoUser();
  await seedDemoOpenOrders(demoUser.id);
  await seedMarketData();
  await seedDailyPnl();
}

main()
  .then(async () => {
    console.info('[seed] completed successfully');
  })
  .catch(async (error) => {
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
