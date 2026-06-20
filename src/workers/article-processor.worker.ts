import { Worker } from "bullmq";
import { getRedisOptions } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { generateUrlHash } from "../utils/hash.js";
import { getTelegramDispatchQueue } from "../lib/queues.js";
import { logger } from "../lib/logger.js";
import type { NormalizedArticle } from "../services/fetcher.service.js";

interface ArticleProcessingJobData {
  articles: NormalizedArticle[];
  executionLogId: string;
}

export function createArticleProcessorWorker(): Worker<ArticleProcessingJobData> {
  const worker = new Worker<ArticleProcessingJobData>(
    "article-processing",
    async (job) => {
      const { articles, executionLogId } = job.data;
      logger.info(`Job ${job.id} processing ${articles.length} articles`);

      const sourceNames = [...new Set(articles.map((a) => a.source))];

      const sourceMap = new Map<string, string>();
      for (const name of sourceNames) {
        const source = await prisma.source.upsert({
          where: { name },
          update: {},
          create: { name, type: "API" },
        });
        sourceMap.set(name, source.id);
      }

      const articleData = articles.map((a) => ({
        sourceId: sourceMap.get(a.source)!,
        title: a.title,
        url: a.url,
        urlHash: generateUrlHash(a.url),
        author: a.author ?? null,
        contentSnippet: a.contentSnippet ?? null,
        publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
      }));

      let insertedCount = 0;
      try {
        const result = await prisma.article.createMany({
          data: articleData,
          skipDuplicates: true,
        });
        insertedCount = result.count;
      } catch {
        const results = await Promise.allSettled(
          articleData.map((data) =>
            prisma.article.upsert({
              where: { urlHash: data.urlHash },
              update: {},
              create: data,
            }),
          ),
        );
        insertedCount = results.filter((r) => r.status === "fulfilled").length;
      }

      await prisma.executionLog.update({
        where: { id: executionLogId },
        data: {
          metadata: {
            fetchedCount: articles.length,
            insertedCount,
            duplicates: articles.length - insertedCount,
          },
        },
      });

      logger.info(`Inserted ${insertedCount}/${articles.length} articles`);

      await getTelegramDispatchQueue().add(
        "dispatch-digest",
        { executionLogId },
        { removeOnComplete: true, removeOnFail: 100 },
      );

      logger.info("Dispatched telegram dispatch job");
    },
    { connection: getRedisOptions() },
  );

  logger.info("Article processor worker registered");
  return worker;
}
