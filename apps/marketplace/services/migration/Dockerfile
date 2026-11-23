FROM node:22.23.1-alpine
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY tools ./tools
RUN npm ci
COPY prisma ./prisma
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]
