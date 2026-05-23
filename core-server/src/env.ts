import "dotenv/config";

export const ENV = {
  PORT: parseInt(process.env.PORT ?? "3020", 10),
  NODE_ENV: process.env.NODE_ENV ?? "development",
} as const;
