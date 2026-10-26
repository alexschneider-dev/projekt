FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY tools/fast-glob ./tools/fast-glob
COPY services/migration/package.json ./services/migration/package.json

RUN npm ci --workspace services/migration --include-workspace-root=false --omit=dev

COPY prisma ./prisma
COPY prisma.config.ts ./

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]
