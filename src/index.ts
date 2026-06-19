import express from "express";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { getRedisConnection } from "./lib/redis.js";
import { healthRouter } from "./api/routes/health.js";

async function main() {
  const app = express();

  app.use(express.json());

  app.use("/health", healthRouter);

  app.listen(env.PORT, () => {
    console.log(`[api] DevDigest Courier listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("[api] Failed to start server:", err);
  process.exit(1);
});

async function shutdown() {
  console.log("[api] Shutting down...");
  await prisma.$disconnect();
  const redis = getRedisConnection();
  if (redis.status !== "end") {
    await redis.quit();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
