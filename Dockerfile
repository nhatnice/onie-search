FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package*.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm run build

FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package*.json /app/pnpm-lock.yaml* /app/pnpm-workspace.yaml* ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts

RUN pnpm install --prod --frozen-lockfile --ignore-scripts

EXPOSE 3000

CMD ["sh", "-c", "pnpm run db:migrate && pnpm start"]