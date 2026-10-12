FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# npm ci runs the postinstall script (`prisma generate`), so Prisma's schema
# and config must already exist in the image at this point.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed && npm run start:prod"]
