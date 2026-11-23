FROM node:22-alpine3.24 AS base

RUN apk upgrade --no-cache \
  && apk add --no-cache curl procps openssl


FROM base AS deps
WORKDIR /app

COPY tools/fast-glob ./tools/fast-glob
COPY tools/minimatch-compat ./tools/minimatch-compat
COPY tools/picomatch-secure ./tools/picomatch-secure
COPY package.json package-lock.json ./
COPY services/migration/package.json ./services/migration/package.json

RUN npm ci


# Separater Importprozess mit denselben festgelegten Paketversionen.
FROM deps AS jobs-deps
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm prune --omit=dev --ignore-scripts


FROM base AS jobs
# Paketmanager werden ausschließlich beim Build benötigt.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg /root/.npm
WORKDIR /app
ENV NODE_ENV=production
COPY --from=jobs-deps /app ./
COPY --chown=node:node scripts/jobs ./scripts/jobs
COPY --chown=node:node lib/schemas/jobs ./lib/schemas/jobs
COPY --chown=node:node lib/auth/role-values.mjs ./lib/auth/role-values.mjs
USER node
CMD ["node", "scripts/jobs/run.mjs"]


FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/tools/fast-glob ./tools/fast-glob
COPY --from=deps /app/tools/minimatch-compat ./tools/minimatch-compat
COPY --from=deps /app/tools/picomatch-secure ./tools/picomatch-secure
COPY . .

RUN npm run build


FROM base AS runner
# Standalone-Next.js startet direkt mit Node.js.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg /root/.npm
WORKDIR /app

ENV NODE_ENV=production
ENV HOME=/home/nextjs

RUN addgroup -S -g 1001 nodejs \
  && adduser -S -D -u 1001 -s /bin/sh -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

RUN mkdir -p /app/.next/cache/fetch-cache /app/.next/cache/images \
  && chown -R nextjs:nodejs /app/.next

USER nextjs

CMD ["node", "server.js"]
