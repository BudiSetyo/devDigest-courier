import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { Router } from "express";

const handleUpdateMock = vi.fn();

describe("POST /telegram", () => {
  let telegramRouter: Router;

  beforeEach(() => {
    vi.clearAllMocks();
    telegramRouter = Router();
    telegramRouter.post("/", (req, res) => {
      handleUpdateMock(req.body, res);
      res.status(200).end();
    });
  });

  it("should return 200 and call handleUpdate with the request body", async () => {
    const app = express();
    app.use(express.json());
    app.use("/telegram", telegramRouter);

    const payload = { update_id: 123, message: { text: "/start" } };

    const res = await request(app).post("/telegram").send(payload);

    expect(res.status).toBe(200);
    expect(handleUpdateMock).toHaveBeenCalledTimes(1);
    expect(handleUpdateMock).toHaveBeenCalledWith(payload, expect.any(Object));
  });

  it("should handle empty body gracefully", async () => {
    const app = express();
    app.use(express.json());
    app.use("/telegram", telegramRouter);

    const res = await request(app).post("/telegram").send({});

    expect(res.status).toBe(200);
    expect(handleUpdateMock).toHaveBeenCalledWith({}, expect.any(Object));
  });
});