import { Router } from "express";
import { telegramService } from "../services/telegram.service.js";
import { prisma } from "../lib/prisma.js";
import { getDigestTriggerQueue } from "../lib/queues.js";
import { logger } from "../lib/logger.js";

export const telegramRouter = Router();

const bot = telegramService.getBotInstance();

bot.command("start", async (ctx) => {
  try {
    const chatId = ctx.chat.id;
    const chat = ctx.chat;
    const fromUser = ctx.from;
    const username =
      ("username" in chat ? chat.username : undefined) ??
      fromUser?.username ??
      null;

    await prisma.subscriber.upsert({
      where: { telegramChatId: BigInt(chatId) },
      update: { username, isActive: true },
      create: { telegramChatId: BigInt(chatId), username },
    });

    await ctx.reply(
      "Welcome to DevDigest Courier! You will receive daily programming news digests.\n\n" +
        "Use /subscribe to start receiving digests.\n" +
        "Use /unsubscribe to stop receiving digests.\n" +
        "Use /status to check your subscription.\n" +
        "Use /logs to view recent execution logs.",
    );
  } catch (err) {
    logger.error("/start error", { error: err });
  }
});

bot.command("help", async (ctx) => {
  try {
    await ctx.reply(
      "Available commands:\n" +
        "/start - Register to daily digests\n" +
        "/subscribe - Subscribe to daily programming news digests\n" +
        "/unsubscribe - Unsubscribe from daily digests\n" +
        "/status - View your subscription status\n" +
        "/logs - View last 3 digest execution logs\n" +
        "/retry - Manually retry a failed digest\n" +
        "/help - Show this help message",
    );
  } catch (err) {
    logger.error("/help error", { error: err });
  }
});

bot.command("subscribe", async (ctx) => {
  try {
    const chatId = ctx.chat.id;

    const subscriber = await prisma.subscriber.findUnique({
      where: { telegramChatId: BigInt(chatId) },
    });

    if (!subscriber) {
      await ctx.reply("Please use /start first to register.");
      return;
    }

    if (subscriber.isActive) {
      await ctx.reply("You are already subscribed to daily digests!");
      return;
    }

    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { isActive: true },
    });

    await ctx.reply("You are now subscribed! You will receive daily programming news digests.");
  } catch (err) {
    logger.error("/subscribe error", { error: err });
    await ctx.reply("Something went wrong. Please try again.").catch(() => {});
  }
});

bot.command("status", async (ctx) => {
  try {
    const chatId = ctx.chat.id;

    const subscriber = await prisma.subscriber.findUnique({
      where: { telegramChatId: BigInt(chatId) },
    });

    if (!subscriber) {
      await ctx.reply("You are not registered yet. Use /start to begin.");
      return;
    }

    if (subscriber.isActive) {
      await ctx.reply("You are subscribed to daily programming news digests. Use /unsubscribe to stop receiving them.");
    } else {
      await ctx.reply("You are not subscribed. Use /subscribe to start receiving daily digests.");
    }
  } catch (err) {
    logger.error("/status error", { error: err });
    await ctx.reply("Failed to fetch status. Please try again.").catch(() => {});
  }
});

bot.command("unsubscribe", async (ctx) => {
  try {
    const chatId = ctx.chat.id;

    const subscriber = await prisma.subscriber.findUnique({
      where: { telegramChatId: BigInt(chatId) },
    });

    if (!subscriber) {
      await ctx.reply("You are not registered yet. Use /start to begin.");
      return;
    }

    if (!subscriber.isActive) {
      await ctx.reply("You are already unsubscribed.");
      return;
    }

    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { isActive: false },
    });

    await ctx.reply("You have been unsubscribed from daily digests. Use /subscribe to rejoin anytime!");
  } catch (err) {
    logger.error("/unsubscribe error", { error: err });
    await ctx.reply("Something went wrong. Please try again.").catch(() => {});
  }
});

bot.command("logs", async (ctx) => {
  try {
    const logs = await prisma.executionLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 3,
    });

    if (logs.length === 0) {
      await ctx.reply("No execution logs yet.");
      return;
    }

    const lines = logs.map((log) => {
      const date = log.startedAt.toISOString().split("T")[0];
      const icon =
        log.status === "success"
          ? "✅"
          : log.status === "failed"
            ? "❌"
            : log.status === "partial_success"
              ? "⚠️"
              : "🔄";
      const meta = (log.metadata ?? {}) as Record<string, unknown>;
      const count = meta.articlesSent ?? meta.fetchedCount ?? "?";
      let line = `${icon} *${log.runType}* on ${date} (${count} articles)`;
      if (log.errorMessage) {
        const shortError =
          log.errorMessage.length > 80
            ? log.errorMessage.slice(0, 77) + "..."
            : log.errorMessage;
        line += `\n   Error: ${shortError}`;
      }
      return line;
    });

    await ctx.reply(`Last ${logs.length} execution logs:\n\n${lines.join("\n\n")}`, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    logger.error("/logs error", { error: err });
    await ctx.reply("Failed to fetch logs. Please try again.").catch(() => {});
  }
});

bot.command("retry", async (ctx) => {
  try {
    await getDigestTriggerQueue().add(
      "manual-retry",
      { runType: "manual_retry" },
      { removeOnComplete: true, removeOnFail: 100 },
    );
    await ctx.reply(
      "🔄 Retrying digest generation... Check /logs in a few minutes.",
    );
  } catch (err) {
    logger.error("/retry error", { error: err });
    await ctx.reply("Failed to trigger retry. Please try again.").catch(() => {});
  }
});

telegramRouter.post("/", (req, res) => {
  void bot.handleUpdate(req.body, res);
});