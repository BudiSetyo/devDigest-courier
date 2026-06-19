import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getRedisConnection } from "../../lib/redis.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "ok";
  } catch {
    checks.db = "error";
  }

  try {
    const redis = getRedisConnection();
    if (redis.status === "ready") {
      checks.redis = "ok";
    } else {
      await redis.ping();
      checks.redis = "ok";
    }
  } catch {
    checks.redis = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  res.status(allOk ? 200 : 503).json({ status: allOk ? "healthy" : "degraded", checks });
});
