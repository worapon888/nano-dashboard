-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('LIMIT', 'MARKET', 'STOP', 'TAKE_PROFIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PARTIAL', 'FILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto_prices" (
    "id" UUID NOT NULL,
    "symbol" VARCHAR(30) NOT NULL,
    "price" DECIMAL(30,10) NOT NULL,
    "volume_24h" DECIMAL(30,10) NOT NULL,
    "price_change_24h" DECIMAL(20,8) NOT NULL,
    "high_24h" DECIMAL(30,10) NOT NULL,
    "low_24h" DECIMAL(30,10) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "crypto_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" UUID NOT NULL,
    "crypto_price_id" UUID NOT NULL,
    "symbol" VARCHAR(30) NOT NULL,
    "price" DECIMAL(30,10) NOT NULL,
    "volume_24h" DECIMAL(30,10) NOT NULL,
    "price_change_24h" DECIMAL(20,8) NOT NULL,
    "high_24h" DECIMAL(30,10) NOT NULL,
    "low_24h" DECIMAL(30,10) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pair" VARCHAR(30) NOT NULL,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL,
    "price" DECIMAL(30,10) NOT NULL,
    "amount" DECIMAL(30,10) NOT NULL,
    "filled_percent" DECIMAL(5,2) NOT NULL,
    "total_usd" DECIMAL(30,10) NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_prices_symbol_key" ON "crypto_prices"("symbol");

-- CreateIndex
CREATE INDEX "crypto_prices_symbol_idx" ON "crypto_prices"("symbol");

-- CreateIndex
CREATE INDEX "crypto_prices_fetched_at_idx" ON "crypto_prices"("fetched_at");

-- CreateIndex
CREATE INDEX "crypto_prices_symbol_fetched_at_idx" ON "crypto_prices"("symbol", "fetched_at");

-- CreateIndex
CREATE INDEX "crypto_prices_source_idx" ON "crypto_prices"("source");

-- CreateIndex
CREATE INDEX "price_history_crypto_price_id_idx" ON "price_history"("crypto_price_id");

-- CreateIndex
CREATE INDEX "price_history_symbol_idx" ON "price_history"("symbol");

-- CreateIndex
CREATE INDEX "price_history_recorded_at_idx" ON "price_history"("recorded_at");

-- CreateIndex
CREATE INDEX "price_history_symbol_recorded_at_idx" ON "price_history"("symbol", "recorded_at");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_user_id_status_idx" ON "orders"("user_id", "status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_crypto_price_id_fkey" FOREIGN KEY ("crypto_price_id") REFERENCES "crypto_prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
