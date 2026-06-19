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
    "Welcome to DevDigest Courier! You will receive daily coding news digests.",
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "Available commands:\n" +
      "/start - Subscribe to daily digests\n" +
      "/help - Show this help message",
  );
});

telegramRouter.post("/webhooks/telegram", (req, res) => {
  void bot.handleUpdate(req.body, res);
});