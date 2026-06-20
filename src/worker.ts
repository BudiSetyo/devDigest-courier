import { getRedisConnection } from "./lib/redis.js";
import { closeAllQueues } from "./lib/queues.js";
import { registerWorker, registerCleanup } from "./lib/shutdown.js";
import { createDigestTriggerWorker } from "./workers/digest-trigger.worker.js";
import { createArticleProcessorWorker } from "./workers/article-processor.worker.js";
import { createTelegramDispatchWorker } from "./workers/telegram-dispatch.worker.js";
import { setupScheduler } from "./lib/scheduler.js";

async function main() {
  const redis = getRedisConnection();

  await redis.connect();
  console.log("[worker] Redis connected");

  registerWorker(createDigestTriggerWorker());
  registerWorker(createArticleProcessorWorker());
  registerWorker(createTelegramDispatchWorker());
  registerCleanup(() => closeAllQueues());

  await setupScheduler();

  console.log("[worker] Workers registered, waiting for jobs...");
}

main().catch((err) => {
  console.error("[worker] Failed to start:", err);
  process.exit(1);
});