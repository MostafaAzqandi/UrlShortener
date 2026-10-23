import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "./logger";

const windowMs: number =
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const max: number = Number(process.env.RATE_LIMIT_MAX) || 100;

export const apiRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(
      { ip: req.ip, url: req.originalUrl, limit: max },
      "Rate limit exceeded",
    );
    res.status(429).json({ err: "Too many requests - try again later" });
  },
});
