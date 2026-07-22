FROM node:22-alpine

WORKDIR /app

COPY services/migration/package.json ./package.json

RUN npm install --omit=dev

COPY prisma ./prisma
COPY prisma.config.ts ./

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]