import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://ci:ci@localhost:5432/ci",
  },
})