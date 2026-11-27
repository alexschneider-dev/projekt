FROM node:22.23.1-alpine3.24
RUN apk upgrade --no-cache && apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY tools ./tools
COPY services/websocket/package.json ./services/websocket/package.json
RUN npm ci
COPY . .
RUN npx prisma generate && chown -R node:node /app
USER node
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev -- --hostname 0.0.0.0"]
