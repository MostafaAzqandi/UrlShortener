import type { ErrorRequestHandler } from "express";
import { logger } from "./logger";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const isDev = process.env.NODE_ENV !== "production";

  let status = 500;
  if (err?.name === "ValidationError") {
    status = 400;
  } else if (typeof err?.statusCode === "number") {
    status = err.statusCode;
  }

  const exposeMessage = status < 500 || isDev;
  const message = exposeMessage && err?.message
    ? err.message
    : "Internal server error";

  logger.error(
    { err, method: req.method, url: req.originalUrl },
    "request failed",
  );

  res.status(status).json({ err: message });
};
