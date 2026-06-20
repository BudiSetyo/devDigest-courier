import { Router } from "express";
import { telegramService } from "../services/telegram.service.js";
import { prisma } from "../lib/prisma.js";
import { getDigestTriggerQueue } from "../lib/queues.js";

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
      "Welcome to DevDigest Courier! You will receive daily coding news digests.\n\n" +
        "Use /topics to see available topics.\n" +
        "Use /subscribe <topic> to pick topics.\n" +
        "Use /status to see your subscriptions.\n" +
        "Use /logs to view recent execution logs.",
    );
  } catch (err) {
    console.error("[telegram] /start error:", err);
  }
});

bot.command("help", async (ctx) => {
  try {
    await ctx.reply(
      "Available commands:\n" +
        "/start - Subscribe to daily digests\n" +
        "/topics - List available topics\n" +
        "/subscribe <topic> - Subscribe to a topic (e.g. /subscribe javascript)\n" +
        "/status - View your subscribed topics\n" +
        "/logs - View last 3 digest execution logs\n" +
        "/retry - Manually retry a failed digest\n" +
        "/help - Show this help message",
    );
  } catch (err) {
    console.error("[telegram] /help error:", err);
  }
});

bot.command("subscribe", async (ctx) => {
  try {
    const chatId = ctx.chat.id;
    const args = ctx.message.text
      .split(" ")
      .slice(1)
      .join(" ")
      .trim()
      .toLowerCase();

    if (!args) {
      await ctx.reply(
        "Usage: /subscribe <topic>\nExample: /subscribe javascript",
      );
      return;
    }

    const subscriber = await prisma.subscriber.findUnique({
      where: { telegramChatId: BigInt(chatId) },
    });

    if (!subscriber) {
      await ctx.reply("Please use /start first to subscribe to the digest.");
      return;
    }

    let topic = await prisma.topic.findUnique({ where: { slug: args } });
    if (!topic) {
      topic = await prisma.topic.findFirst({
        where: { name: { equals: args, mode: "insensitive" } },
      });
    }
    if (!topic) {
      await ctx.reply(
        `Topic "${args}" not found. Use /topics to see available topics.`,
      );
      return;
    }

    await prisma.subscriberTopic.upsert({
      where: {
        subscriberId_topicId: {
          subscriberId: subscriber.id,
          topicId: topic.id,
        },
      },
      update: {},
      create: {
        subscriberId: subscriber.id,
        topicId: topic.id,
      },
    });

    await ctx.reply(`Subscribed to *${topic.name}*`, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("[telegram] /subscribe error:", err);
    await ctx.reply("Something went wrong. Please try again.").catch(() => {});
  }
});

bot.command("topics", async (ctx) => {
  try {
    const topics = await prisma.topic.findMany({ orderBy: { name: "asc" } });

    if (topics.length === 0) {
      await ctx.reply(
        "No topics available yet. Topics will appear after seeding.",
      );
      return;
    }

    const topicList = topics
      .map((t) => `• ${t.name} (/subscribe ${t.slug})`)
      .join("\n");

    await ctx.reply(`Available topics:\n${topicList}`);
  } catch (err) {
    console.error("[telegram] /topics error:", err);
    await ctx.reply("Failed to fetch topics. Please try again.").catch(() => {});
  }
});

bot.command("status", async (ctx) => {
  try {
    const chatId = ctx.chat.id;

    const subscriber = await prisma.subscriber.findUnique({
      where: { telegramChatId: BigInt(chatId) },
      include: { topics: { include: { topic: true } } },
    });

    if (!subscriber) {
      await ctx.reply("You are not subscribed yet. Use /start to begin.");
      return;
    }

    if (subscriber.topics.length === 0) {
      await ctx.reply(
        "You are subscribed to the daily digest but have not picked any topics yet.\n\n" +
          "Use /subscribe <topic> to pick a topic.",
      );
      return;
    }

    const topicList = subscriber.topics
      .map((st) => `• ${st.topic.name} (${st.topic.slug})`)
      .join("\n");

    await ctx.reply(`Your subscribed topics:\n${topicList}`);
  } catch (err) {
    console.error("[telegram] /status error:", err);
    await ctx.reply("Failed to fetch status. Please try again.").catch(() => {});
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
    console.error("[telegram] /logs error:", err);
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
    console.error("[telegram] /retry error:", err);
    await ctx.reply("Failed to trigger retry. Please try again.").catch(() => {});
  }
});

telegramRouter.post("/webhooks/telegram", (req, res) => {
  void bot.handleUpdate(req.body, res);
});