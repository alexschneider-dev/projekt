FROM node:22.23.1-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY tools ./tools
RUN npm ci
COPY . .
RUN npx prisma generate && chown -R node:node /app
USER node
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev -- --hostname 0.0.0.0"]
