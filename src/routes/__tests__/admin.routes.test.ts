import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { Router } from "express";

const addMock = vi.fn().mockResolvedValue({ id: "mock-job-123" });

vi.mock("../../lib/queues.js", () => ({
  getDigestTriggerQueue: () => ({
    add: addMock,
  }),
}));

async function createApp() {
  const adminRouter = Router();
  adminRouter.post("/trigger-digest", async (_req, res) => {
    const { getDigestTriggerQueue } = await import("../../lib/queues.js");
    const job = await getDigestTriggerQueue().add(
      "manual-digest",
      { runType: "manual" },
      { removeOnComplete: true, removeOnFail: 100 },
    );
    res.status(202).json({
      message: "Digest job triggered",
      jobId: job.id,
    });
  });

  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  return app;
}

describe("POST /admin/trigger-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 202 and enqueue a digest job", async () => {
    const app = await createApp();

    const res = await request(app).post("/admin/trigger-digest");

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      message: "Digest job triggered",
      jobId: "mock-job-123",
    });
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith(
      "manual-digest",
      { runType: "manual" },
      { removeOnComplete: true, removeOnFail: 100 },
    );
  });
});