FROM node:22.23.1-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY tools ./tools
COPY services/websocket/package.json ./services/websocket/package.json
RUN npm ci --omit=dev --workspace marketplace-websocket --include-workspace-root=false && npm cache clean --force
COPY services/websocket/*.mjs ./services/websocket/
COPY services/websocket/errors ./services/websocket/errors
WORKDIR /app/services/websocket
USER node
EXPOSE 3010
CMD ["node", "index.mjs"]
