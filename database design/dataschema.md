generator client {
provider = "prisma-client-js"
}

datasource db {
provider = "postgresql"
url = env("DATABASE_URL")
}

enum UserRole {
USER
ADMIN
}

enum PriceSource {
BINANCE
}

model User {
id String @id @default(uuid()) @db.Uuid
email String @unique @db.VarChar(255)
passwordHash String @map("password_hash") @db.Text
displayName String @map("display_name") @db.VarChar(100)
role UserRole @default(USER)
isActive Boolean @default(true) @map("is_active")
createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)

@@index([role], map: "users_role_idx")
@@index([isActive], map: "users_active_idx")
@@index([deletedAt], map: "users_deleted_at_idx")
@@map("users")
}

model CryptoPrice {
id String @id @default(uuid()) @db.Uuid
symbol String @unique @db.VarChar(20)
price Decimal @db.Decimal(20, 8)
volume24h Decimal? @map("volume_24h") @db.Decimal(24, 8)
priceChange24h Decimal? @map("price_change_24h") @db.Decimal(20, 8)
high24h Decimal? @map("high_24h") @db.Decimal(20, 8)
low24h Decimal? @map("low_24h") @db.Decimal(20, 8)
source PriceSource @default(BINANCE)
fetchedAt DateTime @map("fetched_at") @db.Timestamptz(6)
createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

priceHistories PriceHistory[]

@@index([fetchedAt], map: "crypto_prices_fetched_at_idx")
@@index([symbol, fetchedAt], map: "crypto_prices_symbol_fetched_at_idx")
@@map("crypto_prices")
}

model PriceHistory {
id String @id @default(uuid()) @db.Uuid
cryptoPriceId String @map("crypto_price_id") @db.Uuid
symbol String @db.VarChar(20)
price Decimal @db.Decimal(20, 8)
volume24h Decimal? @map("volume_24h") @db.Decimal(24, 8)
priceChange24h Decimal? @map("price_change_24h") @db.Decimal(20, 8)
high24h Decimal? @map("high_24h") @db.Decimal(20, 8)
low24h Decimal? @map("low_24h") @db.Decimal(20, 8)
source PriceSource @default(BINANCE)
recordedAt DateTime @map("recorded_at") @db.Timestamptz(6)
createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

cryptoPrice CryptoPrice @relation(fields: [cryptoPriceId], references: [id], onDelete: Cascade)

@@index([cryptoPriceId], map: "price_history_crypto_price_id_idx")
@@index([symbol, recordedAt], map: "price_history_symbol_recorded_at_idx")
@@index([recordedAt], map: "price_history_recorded_at_idx")
@@map("price_history")
}
