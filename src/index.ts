import express from "express";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { getRedisConnection } from "./lib/redis.js";
import { initQueues } from "./lib/queues.js";
import { router } from "./routes/index.js";
import { telegramService } from "./services/telegram.service.js";

async function main() {
  const app = express();

  app.use(express.json());

  initQueues();

  app.use('/api/v1', router);

  app.listen(env.PORT, () => {
    console.log(`[api] DevDigest Courier listening on port ${env.PORT}`);
  });

  let webhookUrl = env.TELEGRAM_WEBHOOK_URL;

  if (!webhookUrl && env.NGROK_AUTHTOKEN) {
    const ngrok = await import("ngrok");
    webhookUrl = await ngrok.connect({ addr: env.PORT, authtoken: env.NGROK_AUTHTOKEN });
    console.log(`[ngrok] Tunnel created: ${webhookUrl}`);
  }

  await telegramService.startBot(webhookUrl);
}

main().catch((err) => {
  console.error("[api] Failed to start server:", err);
  process.exit(1);
});

async function shutdown() {
  console.log("[api] Shutting down...");
  await telegramService.stopBot();
  await prisma.$disconnect();
  const redis = getRedisConnection();
  if (redis.status !== "end") {
    await redis.quit();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
