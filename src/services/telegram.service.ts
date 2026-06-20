import { Telegraf } from "telegraf";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

class TelegramService {
  private bot: Telegraf | null = null;

  private getBot(): Telegraf {
    if (!this.bot) {
      this.bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
    }
    return this.bot;
  }

  async startBot(webhookUrl?: string): Promise<void> {
    const bot = this.getBot();

    if (webhookUrl) {
      const hookPath = "/api/v1/telegram";
      const fullUrl = `${webhookUrl.replace(/\/$/, "")}${hookPath}`;
      await bot.telegram.setWebhook(fullUrl);
      logger.info(`Webhook set to ${fullUrl}`);
    } else {
      await bot.launch();
      logger.info("Bot started in polling mode");
    }
  }

  async stopBot(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
    }
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    await this.getBot().telegram.sendMessage(chatId, text, {
      parse_mode: "Markdown",
    });
  }

  getBotInstance(): Telegraf {
    return this.getBot();
  }
}

export const telegramService = new TelegramService();
