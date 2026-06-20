import { Worker } from "bullmq";
import { getRedisOptions } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { fetchAllSources } from "../services/fetcher.service.js";
import { getArticleProcessingQueue } from "../lib/queues.js";
import { logger } from "../lib/logger.js";
import type { NormalizedArticle } from "../services/fetcher.service.js";

interface DigestTriggerJobData {
  runType: string;
}

export function createDigestTriggerWorker(): Worker<DigestTriggerJobData> {
  const worker = new Worker<DigestTriggerJobData>(
    "digest-trigger",
    async (job) => {
      const runType = job.data.runType ?? "scheduled";
      logger.info(`Job ${job.id} started`, { runType });

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
          logger.info(`Enqueued ${articles.length} articles for processing`);
        } else {
          await prisma.executionLog.update({
            where: { id: log.id },
            data: {
              status: "success",
              finishedAt: new Date(),
              metadata: { fetchedCount: 0, reason: "no_articles" },
            },
          });
          logger.info("No articles fetched, marking complete");
        }
      } catch (err) {
        logger.error("Digest trigger fatal error", { error: err });
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
            logger.error("Failed to update execution log", { error: updateErr });
          });
        throw err;
      }
    },
    { connection: getRedisOptions() },
  );

  logger.info("Digest trigger worker registered");
  return worker;
}
