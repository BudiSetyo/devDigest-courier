import { Telegraf } from "telegraf";
import { env } from "../lib/env.js";

class TelegramService {
  private bot: Telegraf | null = null;

  private getBot(): Telegraf {
    if (!this.bot) {
      this.bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
    }
    return this.bot;
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
