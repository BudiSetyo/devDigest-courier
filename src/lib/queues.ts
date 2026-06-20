import { Queue } from "bullmq";
import { getRedisOptions } from "./redis.js";
import { logger } from "./logger.js";

let digestTriggerQueue: Queue | null = null;
let articleProcessingQueue: Queue | null = null;
let telegramDispatchQueue: Queue | null = null;

export function getDigestTriggerQueue(): Queue {
  if (!digestTriggerQueue) {
    digestTriggerQueue = new Queue("digest-trigger", {
      connection: getRedisOptions(),
    });
  }
  return digestTriggerQueue;
}

export function getArticleProcessingQueue(): Queue {
  if (!articleProcessingQueue) {
    articleProcessingQueue = new Queue("article-processing", {
      connection: getRedisOptions(),
    });
  }
  return articleProcessingQueue;
}

export function getTelegramDispatchQueue(): Queue {
  if (!telegramDispatchQueue) {
    telegramDispatchQueue = new Queue("telegram-dispatch", {
      connection: getRedisOptions(),
    });
  }
  return telegramDispatchQueue;
}

export function initQueues(): void {
  getDigestTriggerQueue();
  getArticleProcessingQueue();
  getTelegramDispatchQueue();
  logger.info("BullMQ queues initialized");
}

export async function closeAllQueues(): Promise<void> {
  const queues = [
    digestTriggerQueue,
    articleProcessingQueue,
    telegramDispatchQueue,
  ];
  for (const queue of queues) {
    if (queue) {
      await queue.close();
    }
  }
  digestTriggerQueue = null;
  articleProcessingQueue = null;
  telegramDispatchQueue = null;
  logger.info("All BullMQ queues closed");
}