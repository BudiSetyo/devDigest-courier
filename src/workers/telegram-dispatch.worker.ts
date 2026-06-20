import { Worker } from "bullmq";
import { getRedisOptions } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { telegramService } from "../services/telegram.service.js";
import { formatDigestMessage } from "../utils/formatter.js";

interface TelegramDispatchJobData {
  executionLogId: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isBlockedError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  if (e.code === 403) return true;
  if (e.error_code === 403) return true;
  if (
    e.response &&
    typeof e.response === "object" &&
    e.response !== null &&
    (e.response as Record<string, unknown>).error_code === 403
  )
    return true;
  if (
    typeof e.description === "string" &&
    e.description.toLowerCase().includes("blocked")
  )
    return true;
  if (
    e.response &&
    typeof e.response === "object" &&
    e.response !== null &&
    typeof (e.response as Record<string, unknown>).description === "string" &&
    ((e.response as Record<string, unknown>).description as string)
      .toLowerCase()
      .includes("blocked")
  )
    return true;
  return false;
}

export function createTelegramDispatchWorker(): Worker<TelegramDispatchJobData> {
  const worker = new Worker<TelegramDispatchJobData>(
    "telegram-dispatch",
    async (job) => {
      const { executionLogId } = job.data;
      console.log(
        `[telegram-dispatch] Job ${job.id} starting for execution ${executionLogId}`,
      );

      const subscribers = await prisma.subscriber.findMany({
        where: { isActive: true },
      });

      if (subscribers.length === 0) {
        console.log("[telegram-dispatch] No active subscribers");
        await prisma.executionLog.update({
          where: { id: executionLogId },
          data: {
            status: "success",
            finishedAt: new Date(),
            metadata: {
              message: "No active subscribers",
              subscribersNotified: 0,
              articlesSent: 0,
            },
          },
        });
        return;
      }

      const pendingArticles = await prisma.article.findMany({
        where: { status: "PENDING" },
        include: { source: true },
        take: 10,
        orderBy: { publishedAt: "desc" },
      });

      if (pendingArticles.length === 0) {
        console.log("[telegram-dispatch] No pending articles");
        await prisma.executionLog.update({
          where: { id: executionLogId },
          data: {
            status: "success",
            finishedAt: new Date(),
            metadata: {
              message: "No new articles",
              subscribersNotified: 0,
              articlesSent: 0,
            },
          },
        });
        return;
      }

      const digestArticles = pendingArticles.map((a) => ({
        title: a.title,
        url: a.url,
        source: a.source.name,
        author: a.author,
      }));

      const chunks = formatDigestMessage(digestArticles);

      let successCount = 0;
      let failCount = 0;

      for (const subscriber of subscribers) {
        try {
          for (const chunk of chunks) {
            await telegramService.sendMessage(
              Number(subscriber.telegramChatId),
              chunk,
            );
            await sleep(50);
          }
          successCount++;
        } catch (err) {
          failCount++;
          console.error(
            `[telegram-dispatch] Failed to send to ${subscriber.telegramChatId}:`,
            err instanceof Error ? err.message : err,
          );

          if (isBlockedError(err)) {
            await prisma.subscriber
              .update({
                where: { id: subscriber.id },
                data: { isActive: false },
              })
              .catch((updateErr) => {
                console.error(
                  `[telegram-dispatch] Failed to deactivate subscriber ${subscriber.id}:`,
                  updateErr,
                );
              });
            console.warn(
              `[telegram-dispatch] Deactivated subscriber ${subscriber.telegramChatId} (blocked bot)`,
            );
          }
        }
      }

      await prisma.article.updateMany({
        where: {
          id: { in: pendingArticles.map((a) => a.id) },
        },
        data: { status: "SENT" },
      });

      await prisma.executionLog.update({
        where: { id: executionLogId },
        data: {
          status: failCount > 0 ? "partial_success" : "success",
          finishedAt: new Date(),
          metadata: {
            articlesSent: pendingArticles.length,
            subscribersNotified: successCount,
            subscribersFailed: failCount,
          },
        },
      });

      console.log(
        `[telegram-dispatch] Done: ${successCount} notified, ${failCount} failed, ${pendingArticles.length} articles sent`,
      );
    },
    { connection: getRedisOptions() },
  );

  console.log("[telegram-dispatch] Worker registered");
  return worker;
}