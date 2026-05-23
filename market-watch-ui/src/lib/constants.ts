export const WS_URL = "ws://localhost:3020/ws";

export const ROUTES = {
  dashboard: "/",
  portfolio: "/portfolio",
  trades: "/trades",
  stocks: "/stocks",
  alerts: "/alerts",
  settings: "/settings",
} as const;

export const SHORTCUTS = {
  "g d": ROUTES.dashboard,
  "g p": ROUTES.portfolio,
  "g t": ROUTES.trades,
  "g w": ROUTES.stocks,
  "g a": ROUTES.alerts,
  "g s": ROUTES.settings,
} as const;
