import pino, { stdTimeFunctions } from "pino";

interface LoggerOptions {
  level?: string;
  prettyPrint?: boolean;
}

function createLogger({ level = "info", prettyPrint = false }: LoggerOptions = {}) {
  const options: pino.LoggerOptions = {
    level,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: stdTimeFunctions.isoTime,
  };

  if (prettyPrint) {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: true,
        ignore: "pid,hostname",
      },
    };
  }

  return pino(options);
}

// Create a logger instance with pretty printing enabled
const logger = createLogger({
  level: "debug", // Set to debug to see all logs
  prettyPrint: true,
});

// Export the logger instance and create function
export { createLogger, logger };
