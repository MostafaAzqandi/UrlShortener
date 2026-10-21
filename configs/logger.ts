import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
};

if (!isProduction) {
  loggerOptions.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:HH:MM:ss",
      ignore: "pid,hostname",
    },
  };
}

export const logger = pino(loggerOptions);