export const STOCKS_ENV = {
  CONFIG_DIR: process.env.STOCKS_CONFIG_DIR ?? "./data/stocks",
} as const;
