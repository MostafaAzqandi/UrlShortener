import "dotenv/config";
import type { Server } from "node:http";
import type { Request, Response } from "express";
import express from "express";
import { connectDatabase } from "./configs/database";
import { createUrl, redirectToUrl } from "./controllers/URLController";
import { logger } from "./configs/logger";
import { errorHandler } from "./configs/errors";
import { registerShutdownHandlers } from "./configs/shutdown";
import { apiRateLimiter } from "./configs/rate";

const PORT: number = Number(process.env.PORT) || 5000;
const app = express();

app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    process: "api",
    timestamp: new Date().toISOString(),
  });
});
app.use(apiRateLimiter);
app.post("/shorten", createUrl);
app.get("/:slug", redirectToUrl);
app.use((req, res, next) => {
  res.status(404).json({ err: "Route not found" });
});
app.use(errorHandler);
let httpServer: Server | undefined;
const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    httpServer = app.listen(PORT, () => {
      logger.info({ port: PORT }, "API server running");
    });
    registerShutdownHandlers(httpServer);
  } catch (error) {
    logger.fatal({ err: error }, "Bootstrap failure during startup sequence");
    process.exit(1);
  }
};

startServer();
