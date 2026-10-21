import mongoose from "mongoose";
import { logger } from "./logger";
export const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    logger.fatal("MONGO_URI is missing from the environment variables");
    process.exit(1);
  }

  try {
    mongoose.connection.on("connected", () =>
      logger.info("MongoDB connected successfully"),
    );
    mongoose.connection.on("error", (err) =>
      logger.error({err}, "MongoDB runtime connection error:"),
    );
    mongoose.connection.on("disconnected", () =>
      logger.warn("MongoDB disconnected"),
    );

    await mongoose.connect(mongoUri, {

    })
  } catch (error) {
    logger.fatal({error},"Failed to initialize database connection: ");
    process.exit(1);
  }
};