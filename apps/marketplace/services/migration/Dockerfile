FROM node:22-alpine3.24
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY tools ./tools
COPY services/websocket/package.json ./services/websocket/package.json
RUN npm ci
# Prisma wird über die bereits installierte CLI gestartet.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg /root/.npm

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]
