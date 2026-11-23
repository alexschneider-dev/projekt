FROM node:22-alpine3.24

RUN apk upgrade --no-cache && apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY tools/fast-glob ./tools/fast-glob
COPY tools/minimatch-compat ./tools/minimatch-compat
COPY tools/picomatch-secure ./tools/picomatch-secure
COPY services/migration/package.json ./services/migration/package.json

RUN npm ci --workspace services/migration --include-workspace-root=false --omit=dev

# Prisma wird über die bereits installierte CLI gestartet.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg /root/.npm

COPY prisma ./prisma
COPY prisma.config.ts ./

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]
