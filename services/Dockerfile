FROM node:22-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl procps \
  && rm -rf /var/lib/apt/lists/*


FROM base AS deps
WORKDIR /app

COPY tools/fast-glob ./tools/fast-glob
COPY package.json package-lock.json ./
COPY services/migration/package.json ./services/migration/package.json

RUN npm ci


FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/tools/fast-glob ./tools/fast-glob
COPY . .

RUN npm run build


FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOME=/home/nextjs

RUN addgroup --system --gid 1001 nodejs \
  && useradd -m -u 1001 -s /bin/bash -g nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

RUN mkdir -p /app/.next/cache/fetch-cache /app/.next/cache/images \
  && chown -R nextjs:nodejs /app/.next

USER nextjs

CMD ["node", "server.js"]