import "dotenv/config";
import type { Request, Response } from "express";
import express from "express";
import { connectDatabase } from "./configs/database";
import { createUrl, redirectToUrl } from "./controllers/URLController";
import { logger } from "./configs/logger";

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
app.post("/shorten", createUrl);
app.get("/:slug", redirectToUrl);
let httpServer: ReturnType<typeof app.listen> | undefined;
const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    httpServer = app.listen(PORT, () => {
      logger.info({ port: PORT }, "API server running");
    });
  } catch (error) {
    logger.fatal({ err: error }, "Bootstrap failure during startup sequence");
    process.exit(1);
  }
};

startServer();
