import express from "express";
import { env } from "./config/env.js";
import { initQueues, closeAllQueues } from "./lib/queues.js";
import { getRedisConnection, closeRedisConnection } from "./lib/redis.js";
import { registerServer, registerWorker, registerCleanup } from "./lib/shutdown.js";
import { router } from "./routes/index.js";
import { telegramService } from "./services/telegram.service.js";
import { createDigestTriggerWorker } from "./workers/digest-trigger.worker.js";
import { createArticleProcessorWorker } from "./workers/article-processor.worker.js";
import { createTelegramDispatchWorker } from "./workers/telegram-dispatch.worker.js";
import { setupScheduler } from "./lib/scheduler.js";
import { logger } from "./lib/logger.js";

async function main() {
  const app = express();

  app.use(express.json());

  initQueues();

  const redis = getRedisConnection();
  await redis.connect();
  logger.info("Redis connected");

  registerWorker(createDigestTriggerWorker());
  registerWorker(createArticleProcessorWorker());
  registerWorker(createTelegramDispatchWorker());
  registerCleanup(() => closeAllQueues());
  registerCleanup(() => closeRedisConnection());
  registerCleanup(() => telegramService.stopBot());

  await setupScheduler();

  app.use("/api/v1", router);

  const server = app.listen(env.PORT, () => {
    logger.info(`DevDigest Courier listening on port ${env.PORT}`);
  });

  registerServer(server);

  let webhookUrl = env.TELEGRAM_WEBHOOK_URL;

  if (!webhookUrl && env.NGROK_AUTHTOKEN) {
    const ngrok = await import("ngrok");
    webhookUrl = await ngrok.connect({
      addr: env.PORT,
      authtoken: env.NGROK_AUTHTOKEN,
    });
    logger.info(`ngrok tunnel created: ${webhookUrl}`);
  }

  await telegramService.startBot(webhookUrl);

  logger.info("Workers registered, waiting for jobs...");
}

main().catch((err) => {
  logger.error("Failed to start server", { error: err });
  process.exit(1);
});