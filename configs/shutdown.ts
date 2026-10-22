import type { Server } from "node:http";
import mongoose from "mongoose";
import { logger } from "./logger";

export const registerShutdownHandlers = (httpServer: Server): void => {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(
      { signal },
      "Shutdown signal received - starting graceful shutdown",
    );

    const forceExitTimer = setTimeout(() => {
      logger.error("Graceful shutdown timed out - forcing exit");
      process.exit(1);
    }, 15000);
    forceExitTimer.unref();

    try {
      logger.info("Closing HTTP server");

      const serverClosed = new Promise<void>((resolve, reject) =>
        httpServer.close((err) => (err ? reject(err) : resolve())),
      );

      httpServer.closeIdleConnections();

      logger.info("Idle connections closed - waiting for in-flight requests");

      await serverClosed;
      logger.info("HTTP connection closed - all connections drained");

      await mongoose.connection.close();
      logger.info("MongoDB connection closed");

      clearTimeout(forceExitTimer);
      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception - shutting down");
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled promise rejection - shutting down");
    shutdown("unhandledRejection");
  });
};
