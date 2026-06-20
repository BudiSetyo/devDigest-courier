import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const dbUrl = new URL(env.DATABASE_URL);
if (!dbUrl.searchParams.has("pgbouncer")) {
  dbUrl.searchParams.set("pgbouncer", "true");
}
if (!dbUrl.searchParams.has("connection_limit")) {
  dbUrl.searchParams.set("connection_limit", "5");
}
if (!dbUrl.searchParams.has("pool_timeout")) {
  dbUrl.searchParams.set("pool_timeout", "20");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasources: {
      db: {
        url: dbUrl.toString(),
      },
    },
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
