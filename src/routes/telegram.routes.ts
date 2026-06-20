import { Router } from "express";
import { telegramService } from "../services/telegram.service.js";
import { prisma } from "../lib/prisma.js";

export const telegramRouter = Router();

const bot = telegramService.getBotInstance();

bot.command("start", async (ctx) => {
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
      "Use /status to see your subscriptions.",
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "Available commands:\n" +
      "/start - Subscribe to daily digests\n" +
      "/topics - List available topics\n" +
      "/subscribe <topic> - Subscribe to a topic (e.g. /subscribe javascript)\n" +
      "/status - View your subscribed topics\n" +
      "/help - Show this help message",
  );
});

bot.command("subscribe", async (ctx) => {
  const chatId = ctx.chat.id;
  const args = ctx.message.text.split(" ").slice(1).join(" ").trim().toLowerCase();

  if (!args) {
    await ctx.reply("Usage: /subscribe <topic>\nExample: /subscribe javascript");
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
      `Topic "${args}" not found. Available topics will be shown after seeding.`,
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
});

bot.command("topics", async (ctx) => {
  const topics = await prisma.topic.findMany({ orderBy: { name: "asc" } });

  if (topics.length === 0) {
    await ctx.reply("No topics available yet. Topics will appear after seeding.");
    return;
  }

  const topicList = topics
    .map((t) => `• ${t.name} (/subscribe ${t.slug})`)
    .join("\n");

  await ctx.reply(`Available topics:\n${topicList}`);
});

bot.command("status", async (ctx) => {
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
});

telegramRouter.post("/webhooks/telegram", (req, res) => {
  void bot.handleUpdate(req.body, res);
});