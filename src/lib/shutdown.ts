import type { Server } from "node:http";
import type { Worker } from "bullmq";
import { prisma } from "./prisma.js";
import { closeRedisConnection } from "./redis.js";

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
  console.log(`[shutdown] Received ${signal}, initiating graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    console.error("[shutdown] Timed out after 15s, forcing exit");
    process.exit(1);
  }, 15000);

  try {
    if (serverRef) {
      await new Promise<void>((resolve) => serverRef!.close(() => resolve()));
      console.log("[shutdown] HTTP server closed");
    }

    for (const worker of workerRefs) {
      await worker.close();
    }
    console.log("[shutdown] BullMQ workers closed");

    for (const fn of cleanupFns) {
      await fn();
    }
    console.log("[shutdown] Cleanup functions executed");

    await prisma.$disconnect();
    console.log("[shutdown] Prisma disconnected");

    await closeRedisConnection();
    console.log("[shutdown] Redis disconnected");
  } catch (err) {
    console.error("[shutdown] Error during shutdown:", err);
  } finally {
    clearTimeout(shutdownTimeout);
    process.exit(0);
  }
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));