import { Router } from "express";
import { healthRouter } from "../api/routes/health.js";
import { telegramRouter } from "./telegram.routes.js";
import { adminRouter } from "./admin.routes.js";

export const router = Router();

router.use("/health", healthRouter);
router.use("/telegram", telegramRouter);
router.use("/admin", adminRouter);