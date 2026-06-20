import type { Server } from "node:http";
import type { Worker } from "bullmq";
import { prisma } from "./prisma.js";
import { closeRedisConnection } from "./redis.js";
import { logger } from "./logger.js";

let serverRef: Server | null = null;
const workerRefs: Worker[] = [];
const cleanupFns: Array<() => Promise<void>> = [];

export function registerServer(server: Server): void {
  serverRef = server;
}

export function registerWorker(worker: Worker): void {
  workerRefs.push(worker);
}

export function registerCleanup(fn: () => Promise<void>): void {
  cleanupFns.push(fn);
}

async function handleShutdown(signal: string) {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error("Shutdown timed out after 15s, forcing exit");
    process.exit(1);
  }, 15000);

  try {
    if (serverRef) {
      await new Promise<void>((resolve) => serverRef!.close(() => resolve()));
      logger.info("HTTP server closed");
    }

    for (const worker of workerRefs) {
      await worker.close();
    }
    logger.info("BullMQ workers closed");

    for (const fn of cleanupFns) {
      await fn();
    }
    logger.info("Cleanup functions executed");

    await prisma.$disconnect();
    logger.info("Prisma disconnected");

    await closeRedisConnection();
    logger.info("Redis disconnected");
  } catch (err) {
    logger.error("Error during shutdown", { error: err });
  } finally {
    clearTimeout(shutdownTimeout);
    process.exit(0);
  }
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));