import { Router } from "express";
import { getDigestTriggerQueue } from "../lib/queues.js";

export const adminRouter = Router();

adminRouter.post("/trigger-digest", async (_req, res) => {
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
