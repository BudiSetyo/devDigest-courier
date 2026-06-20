import Redis from "ioredis";
import { env } from "../config/env.js";

function buildRedisOptions() {
  const common = {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy(times: number) {
      if (times > 10) return null;
      return Math.min(times * 200, 4000);
    },
  };

  if (env.REDIS_URL) {
    const url = new URL(env.REDIS_URL);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      tls: url.protocol === "rediss:" ? {} : undefined,
      ...common,
    };
  }

  return {
    host: env.REDIS_HOST!,
    port: env.REDIS_PORT!,
    password: env.REDIS_PASSWORD,
    tls: env.REDIS_TLS ? {} : undefined,
    ...common,
  };
}

const redisOptions = buildRedisOptions();

export function getRedisOptions() {
  return redisOptions;
}

let connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (connection) {
    return connection;
  }

  if (env.REDIS_URL) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy(times: number) {
        if (times > 10) return null;
        return Math.min(times * 200, 4000);
      },
    });
  } else {
    connection = new Redis(getRedisOptions());
  }

  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}