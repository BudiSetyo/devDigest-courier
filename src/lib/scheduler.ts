import { env } from "../config/env.js";
import { getDigestTriggerQueue } from "./queues.js";
import { logger } from "./logger.js";

export async function setupScheduler(): Promise<void> {
  await getDigestTriggerQueue().add(
    "scheduled-digest",
    { runType: "scheduled" },
    {
      repeat: { pattern: env.DIGEST_CRON },
      jobId: "daily-digest-repeat",
    },
  );

  logger.info(`Daily digest scheduled at ${env.DIGEST_CRON} (UTC)`);
}