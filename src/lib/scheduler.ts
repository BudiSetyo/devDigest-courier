import { getDigestTriggerQueue } from "./queues.js";

export async function setupScheduler(): Promise<void> {
  // BullMQ repeatable jobs use a persistent jobId to avoid duplicates on restart.
  // The cron expression is in UTC. To adjust timezone, wrap with a TZ-aware
  // wrapper or use a different pattern (e.g. "0 8 * * *" = 08:00 UTC daily).
  await getDigestTriggerQueue().add(
    "scheduled-digest",
    { runType: "scheduled" },
    {
      repeat: { pattern: "0 8 * * *" },
      jobId: "daily-digest-repeat",
    },
  );

  console.log("[scheduler] Daily digest scheduled at 08:00 UTC");
}
