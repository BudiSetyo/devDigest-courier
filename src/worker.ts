import { getRedisConnection } from "./lib/redis.js";
import { closeAllQueues } from "./lib/queues.js";
import { registerWorker, registerCleanup } from "./lib/shutdown.js";
import { createDigestTriggerWorker } from "./workers/digest-trigger.worker.js";
import { createArticleProcessorWorker } from "./workers/article-processor.worker.js";
import { createTelegramDispatchWorker } from "./workers/telegram-dispatch.worker.js";
import { setupScheduler } from "./lib/scheduler.js";
import { logger } from "./lib/logger.js";

async function main() {
  const redis = getRedisConnection();

  await redis.connect();
  logger.info("Redis connected");

  registerWorker(createDigestTriggerWorker());
  registerWorker(createArticleProcessorWorker());
  registerWorker(createTelegramDispatchWorker());
  registerCleanup(() => closeAllQueues());

  await setupScheduler();

  logger.info("Workers registered, waiting for jobs...");
}

main().catch((err) => {
  logger.error("Worker failed to start", { error: err });
  process.exit(1);
});