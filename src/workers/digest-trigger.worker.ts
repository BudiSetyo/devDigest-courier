import { Worker } from "bullmq";
import { getRedisOptions } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { fetchAllSources } from "../services/fetcher.service.js";
import { getArticleProcessingQueue } from "../lib/queues.js";
import type { NormalizedArticle } from "../services/fetcher.service.js";

interface DigestTriggerJobData {
  runType: string;
}

export function createDigestTriggerWorker(): Worker<DigestTriggerJobData> {
  const worker = new Worker<DigestTriggerJobData>(
    "digest-trigger",
    async (job) => {
      const runType = job.data.runType ?? "scheduled";
      console.log(`[digest-trigger] Job ${job.id} started (runType: ${runType})`);

      const log = await prisma.executionLog.create({
        data: {
          runType,
          status: "running",
        },
      });

      try {
        const articles: NormalizedArticle[] = await fetchAllSources();

        await prisma.executionLog.update({
          where: { id: log.id },
          data: {
            metadata: { fetchedCount: articles.length },
          },
        });

        if (articles.length > 0) {
          await getArticleProcessingQueue().add(
            "process-articles",
            { articles, executionLogId: log.id },
            { removeOnComplete: true, removeOnFail: 100 },
          );
          console.log(
            `[digest-trigger] Enqueued ${articles.length} articles for processing`,
          );
        } else {
          await prisma.executionLog.update({
            where: { id: log.id },
            data: {
              status: "success",
              finishedAt: new Date(),
              metadata: { fetchedCount: 0, reason: "no_articles" },
            },
          });
          console.log("[digest-trigger] No articles fetched, marking complete");
        }
      } catch (err) {
        console.error("[digest-trigger] Fatal error:", err);
        await prisma.executionLog
          .update({
            where: { id: log.id },
            data: {
              status: "failed",
              finishedAt: new Date(),
              errorMessage:
                err instanceof Error ? err.message : "Unknown error",
            },
          })
          .catch((updateErr) => {
            console.error(
              "[digest-trigger] Failed to update execution log:",
              updateErr,
            );
          });
        throw err;
      }
    },
    { connection: getRedisOptions() },
  );

  console.log("[digest-trigger] Worker registered");
  return worker;
}
