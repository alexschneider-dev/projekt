import "dotenv/config"
import { defineConfig, env } from "prisma/config"
import dotenv from "dotenv"

dotenv.config({
  path: "services/development/scripts/.env.development.docker",
})

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
})