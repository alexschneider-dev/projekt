FROM node:22.23.1-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY tools ./tools
RUN npm ci

FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_BASE_PATH=/marketplace
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN npm run build

FROM node:22.23.1-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3001
CMD ["node", "server.js"]
