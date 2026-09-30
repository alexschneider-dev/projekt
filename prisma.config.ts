import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(process.cwd(), "prisma"),
  migrations: {
    path: path.join(process.cwd(), 'prisma', 'migrations'),
  },
});
