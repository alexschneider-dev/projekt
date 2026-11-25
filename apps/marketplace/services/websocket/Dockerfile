FROM node:22-alpine3.24 AS dependencies
WORKDIR /app
RUN apk upgrade --no-cache
COPY package.json package-lock.json ./
COPY tools ./tools
COPY services/websocket/package.json ./services/websocket/package.json
RUN npm ci --omit=dev --workspace marketplace-websocket --include-workspace-root=false && npm cache clean --force

FROM node:22-alpine3.24 AS runtime
# Die installierte Anwendung benötigt zur Laufzeit weder npm noch Yarn.
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg /root/.npm
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY services/websocket/package.json ./services/websocket/package.json
COPY services/websocket/*.mjs ./services/websocket/
COPY services/websocket/errors ./services/websocket/errors
WORKDIR /app/services/websocket
USER node
EXPOSE 3010
CMD ["node", "index.mjs"]
