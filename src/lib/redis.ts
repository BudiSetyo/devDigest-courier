import Redis from "ioredis";
import { env } from "./env.js";

let connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (connection) {
    return connection;
  }

  connection = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    tls: env.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 10) {
        return null;
      }
      return Math.min(times * 200, 4000);
    },
    lazyConnect: true,
  });

  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
