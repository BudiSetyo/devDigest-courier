import express from "express";
import { env } from "./config/env.js";
import { initQueues, closeAllQueues } from "./lib/queues.js";
import { registerServer, registerCleanup } from "./lib/shutdown.js";
import { router } from "./routes/index.js";
import { telegramService } from "./services/telegram.service.js";

async function main() {
  const app = express();

  app.use(express.json());

  initQueues();

  app.use("/api/v1", router);

  const server = app.listen(env.PORT, () => {
    console.log(`[api] DevDigest Courier listening on port ${env.PORT}`);
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
    console.log(`[ngrok] Tunnel created: ${webhookUrl}`);
  }

  await telegramService.startBot(webhookUrl);
}

main().catch((err) => {
  console.error("[api] Failed to start server:", err);
  process.exit(1);
});