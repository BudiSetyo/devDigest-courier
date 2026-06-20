import { env } from "../config/env.js";
import { getDigestTriggerQueue } from "./queues.js";

export async function setupScheduler(): Promise<void> {
  await getDigestTriggerQueue().add(
    "scheduled-digest",
    { runType: "scheduled" },
    {
      repeat: { pattern: env.DIGEST_CRON },
      jobId: "daily-digest-repeat",
    },
  );

  console.log(`[scheduler] Daily digest scheduled at ${env.DIGEST_CRON} (UTC)`);
}