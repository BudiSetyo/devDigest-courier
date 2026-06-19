import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string().min(1),
  REDIS_TLS: z
    .enum(["true", "false"])
    .transform((v) => v === "true"),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DIGEST_CRON: z.string().default("0 8 * * *"),
  DIGEST_MAX_ARTICLES: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
