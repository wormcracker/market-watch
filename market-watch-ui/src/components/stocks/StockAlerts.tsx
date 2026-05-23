"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Alert } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type Props = { symbol: string };

interface AlertsResp { data?: Alert[]; alerts?: Alert[] }

export function StockAlerts({ symbol }: Props) {
  const { data } = useQuery<AlertsResp>({
    queryKey: ["alerts-symbol", symbol],
    queryFn: () => apiFetch<AlertsResp>(`watchers/alerts`),
    refetchInterval: 30_000,
  });

  const all: Alert[] = data?.data ?? data?.alerts ?? [];
  const symbolAlerts = all
    .filter((a) => a.watchName?.toLowerCase().includes(symbol.toLowerCase()))
    .sort((a, b) => new Date(b.firedAt).getTime() - new Date(a.firedAt).getTime())
    .slice(0, 10);

  if (symbolAlerts.length === 0) return null;

  const unreadCount = symbolAlerts.filter((a) => !a.readAt).length;

  return (
    <div className="bg-surface rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted uppercase tracking-wider">Alerts</p>
        {unreadCount > 0 && (
          <span className="text-[10px] bg-danger/10 text-danger px-2 py-0.5 rounded-full font-medium">
            {unreadCount} unread
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {symbolAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex flex-col gap-1 p-3 rounded-xl border transition ${
              alert.readAt ? "bg-elevated border-transparent opacity-60" : "bg-danger/5 border-danger/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fg">{alert.watchName}</span>
              {!alert.readAt && <span className="w-1.5 h-1.5 rounded-full bg-danger" />}
            </div>
            {alert.condition && (
              <p className="text-xs text-muted">
                {typeof alert.condition === "string" ? alert.condition : (alert.condition as any).type}
                {alert.currentValue != null && <> → <span className="font-mono text-fg">{String(alert.currentValue)}</span></>}
              </p>
            )}
            <p className="text-[10px] text-faint">{formatDate(alert.firedAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
