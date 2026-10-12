FROM node:24-alpine AS builder

# better-sqlite3 13 ships no prebuilt binaries; it compiles on install.
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN mkdir -p /data && pnpm build

# ---

# Production deps compile here so the final image carries no toolchain.
FROM node:24-alpine AS prod-deps

RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---

FROM node:24-alpine

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules

RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/data/yeetbin.db

EXPOSE 3000

COPY --from=builder /app/scripts ./scripts

CMD ["sh", "-c", "node scripts/init-db.js && node build/index.js"]
