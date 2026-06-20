import { getRedisConnection, closeRedisConnection } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";
import { createDigestTriggerWorker } from "./workers/digest-trigger.worker.js";
import { createArticleProcessorWorker } from "./workers/article-processor.worker.js";
import { createTelegramDispatchWorker } from "./workers/telegram-dispatch.worker.js";
import { setupScheduler } from "./lib/scheduler.js";

async function main() {
  const redis = getRedisConnection();

  await redis.connect();
  console.log("[worker] Redis connected");

  createDigestTriggerWorker();
  createArticleProcessorWorker();
  createTelegramDispatchWorker();

  await setupScheduler();

  console.log("[worker] Workers registered, waiting for jobs...");
}

main().catch((err) => {
  console.error("[worker] Failed to start:", err);
  process.exit(1);
});

async function shutdown() {
  console.log("[worker] Shutting down...");
  await prisma.$disconnect();
  await closeRedisConnection();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);