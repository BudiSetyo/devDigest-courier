import { getRedisConnection, closeRedisConnection } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";

async function main() {
  const redis = getRedisConnection();

  await redis.connect();
  console.log("[worker] Redis connected");

  // TODO: Register BullMQ workers here once business logic is implemented.
  // Example:
  // const fetchWorker = new Worker("fetch-articles", async (job) => { ... }, { connection: redis });
  // const digestWorker = new Worker("send-digest", async (job) => { ... }, { connection: redis });

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
