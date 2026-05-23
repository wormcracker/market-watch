import { useEffect, useRef, useState } from "react";
import type {
  WsMessage,
  MarketUpdatePayload,
  AlertFiredPayload,
  ConnectedPayload,
} from "@/lib/types";

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    return `${protocol}//${host}:3020/ws`;
  }
  return "ws://localhost:3020/ws";
}

const PING_INTERVAL_MS = 30_000;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

type WsOptions = {
  onMarketUpdate?: (payload: MarketUpdatePayload) => void;
  onAlertFired?: (payload: AlertFiredPayload) => void;
  onConnected?: (payload: ConnectedPayload) => void;
  onDisconnected?: () => void;
};

type WsReturn = { status: "connecting" | "connected" | "disconnected" };
//
// Add this helper above the useWebSocket function
function showBrowserNotification(title: string, body: string): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  // Try SW route first (works on Android, desktop)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => {
        const target = reg.active ?? reg.waiting ?? reg.installing;
        if (target) {
          target.postMessage({ type: "SHOW_NOTIFICATION", title, body });
          return;
        }
        // SW not ready — fall back to direct Notification
        new Notification(title, { body, icon: "/icon-192.png" });
      })
      .catch(() => {
        new Notification(title, { body, icon: "/icon-192.png" });
      });
  } else {
    // No SW support — direct Notification (desktop fallback)
    new Notification(title, { body, icon: "/icon-192.png" });
  }
}

export function useWebSocket(options: WsOptions): WsReturn {
  const [status, setStatus] = useState<WsReturn["status"]>("connecting");
  const socket = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentDelay = useRef<number>(BASE_DELAY_MS);
  const optionsRef = useRef(options);
  const mountedRef = useRef(true);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  function connect() {
    if (!mountedRef.current) return;
    const ws = new WebSocket(getWsUrl());
    socket.current = ws;
    if (mountedRef.current) setStatus("connecting");

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus("connected");
      currentDelay.current = BASE_DELAY_MS;
      pingInterval.current = setInterval(() => {
        if (socket.current?.readyState === WebSocket.OPEN)
          socket.current.send(JSON.stringify({ type: "ping" }));
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        switch (msg.type) {
          case "connected":
            optionsRef.current.onConnected?.(msg.payload);
            if (msg.payload.data)
              optionsRef.current.onMarketUpdate?.({
                source: msg.payload.source,
                data: msg.payload.data,
              });
            break;
          case "market_update":
            optionsRef.current.onMarketUpdate?.(msg.payload);
            break;
          case "alert_fired":
            optionsRef.current.onAlertFired?.(msg.payload);
            showBrowserNotification(
              msg.payload.watchName ?? "Market Watch Alert",
              String(msg.payload.value ?? ""),
            ).catch(() => {});
            break;
          case "pong":
            break;
        }
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus("disconnected");
      optionsRef.current.onDisconnected?.();
      if (pingInterval.current) clearInterval(pingInterval.current);
      const delay = currentDelay.current;
      currentDelay.current = Math.min(delay * 2, MAX_DELAY_MS);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingInterval.current) clearInterval(pingInterval.current);
      socket.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status };
}
