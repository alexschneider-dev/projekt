FROM node:22-alpine3.24 AS dependencies
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY tools ./tools
COPY services/websocket/package.json ./services/websocket/package.json
RUN npm ci

FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_BASE_PATH=/marketplace
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN npm run build

FROM node:22-alpine3.24 AS runtime
# Standalone-Next.js benötigt keine Paketmanager zur Laufzeit.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg /root/.npm
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache openssl
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Der Demo-Katalog lässt sich mit dem eingeschränkten App-Zugang befüllen.
COPY --from=build --chown=node:node /app/scripts/seed.mjs /app/scripts/common.mjs ./scripts/
COPY --from=build --chown=node:node /app/scripts/errors ./scripts/errors
COPY --from=build --chown=node:node /app/lib/auth/password.mjs ./lib/auth/password.mjs
COPY --from=build --chown=node:node /app/lib/http/errors/password.mjs ./lib/http/errors/password.mjs
USER node
EXPOSE 3001
CMD ["node", "server.js"]
