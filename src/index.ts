import express from "express";
import { env } from "./config/env.js";
import { initQueues, closeAllQueues } from "./lib/queues.js";
import { registerServer, registerCleanup } from "./lib/shutdown.js";
import { router } from "./routes/index.js";
import { telegramService } from "./services/telegram.service.js";
import { logger } from "./lib/logger.js";

async function main() {
  const app = express();

  app.use(express.json());

  initQueues();

  app.use("/api/v1", router);

  const server = app.listen(env.PORT, () => {
    logger.info(`DevDigest Courier listening on port ${env.PORT}`);
  });

  registerServer(server);
  registerCleanup(() => telegramService.stopBot());
  registerCleanup(() => closeAllQueues());

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
}

main().catch((err) => {
  logger.error("Failed to start server", { error: err });
  process.exit(1);
});