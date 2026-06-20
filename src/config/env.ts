import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    REDIS_HOST: z.string().min(1).optional(),
    REDIS_PORT: z.coerce.number().int().positive().optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_TLS: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1),
    TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
    NGROK_AUTHTOKEN: z.string().optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    DIGEST_CRON: z.string().default("0 8 * * *"),
    DIGEST_MAX_ARTICLES: z.coerce.number().int().positive().default(10),
  })
  .refine(
    (data) =>
      data.REDIS_URL ||
      (data.REDIS_HOST && data.REDIS_PORT && data.REDIS_PASSWORD),
    {
      message:
        "Either REDIS_URL or REDIS_HOST+REDIS_PORT+REDIS_PASSWORD must be provided",
    },
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(JSON.stringify(parsed.error.flatten(), null, 2));
  process.exit(1);
}

export const env = parsed.data;