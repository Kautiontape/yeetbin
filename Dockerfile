FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN mkdir -p /data && pnpm build

# ---

FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/data/yeetbin.db

EXPOSE 3000

COPY --from=builder /app/scripts ./scripts

CMD ["sh", "-c", "node scripts/init-db.js && node build/index.js"]
