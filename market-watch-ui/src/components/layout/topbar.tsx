"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, RefreshCw, X, CheckCheck, Clock } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import ThemeSwitcher from "./theme-swithcer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost } from "@/lib/api";
import type { Alert } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  chukul: "Chukul",
  merolagani: "Merolagani",
  memory_cache: "Cache",
  disk_cache: "Disk",
  snapshot: "Snapshot",
};

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/portfolio": "Portfolio",
  "/trades": "Trades",
  "/stocks": "Stocks",
  "/watchers": "Watchers",
  "/settings": "Settings",
};

export function TopBar() {
  const wsStatus = useAppStore((s) => s.wsStatus);
  const priceSource = useAppStore((s) => s.pricesSource);
  const liveUnreadCount = useAppStore((s) => s.liveUnreadCount);
  const liveAlerts = useAppStore((s) => s.liveAlerts);
  const markAllLiveRead = useAppStore((s) => s.markAllLiveRead);
  const pathname = usePathname();
  const qc = useQueryClient();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertTab, setAlertTab] = useState<"all" | "unread">("unread");
  const alertsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // ── Bell pulse state — fires on each new WS alert ─────────────
  // Tracks the previous liveUnreadCount to detect new arrivals.
  const prevLiveCount = useRef(liveUnreadCount);
  const [bellPulse, setBellPulse] = useState(false);

  useEffect(() => {
    if (liveUnreadCount > prevLiveCount.current) {
      // New alert arrived via WS — pulse the bell
      setBellPulse(true);
      const t = setTimeout(() => setBellPulse(false), 1800);
      prevLiveCount.current = liveUnreadCount;
      return () => clearTimeout(t);
    }
    prevLiveCount.current = liveUnreadCount;
  }, [liveUnreadCount]);

  // ── Background unread count — always-on, not gated on panel open ─
  // Lightweight fetch: just unread alerts count so badge is always correct.
  // Refetches every 30s and also whenever invalidated (e.g. after mark-read).
  const { data: bgUnreadAlerts } = useQuery<Alert[]>({
    queryKey: ["alerts-unread-bg"],
    queryFn: () => apiFetch<Alert[]>("watchers/alerts?unread=true&limit=100"),
    refetchInterval: false, // ← no polling
    staleTime: Infinity, // ← never considered stale on its own
  });

  // Invalidate bg count whenever a new WS alert fires
  useEffect(() => {
    if (liveUnreadCount > 0) {
      qc.invalidateQueries({ queryKey: ["alerts-unread-bg"] });
      qc.invalidateQueries({ queryKey: ["alerts-topbar"] });
    }
  }, [liveUnreadCount, qc]);

  // ── Full alert list — only fetched when panel is open ────────────
  const { data: restAlerts } = useQuery<Alert[]>({
    queryKey: ["alerts-topbar"],
    queryFn: () => apiFetch<Alert[]>("watchers/alerts?limit=50"),
    enabled: alertsOpen,
    refetchInterval: false,
    staleTime: Infinity,
  });

  const markReadMut = useMutation({
    mutationFn: (ids: string[]) => apiPost("watchers/alerts/read", { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts-topbar"] });
      qc.invalidateQueries({ queryKey: ["alerts-unread-bg"] });
    },
  });

  const refreshMut = useMutation({
    mutationFn: () => apiPost("nepse/refresh"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["trades-all"] });
    },
  });

  const allRestAlerts: Alert[] = restAlerts ?? [];
  const unreadRestAlerts = allRestAlerts.filter((a) => !a.readAt);

  // Badge = live WS unreads + REST unreads (bg query keeps this accurate always)
  // When panel is open and we have the full list, prefer that for precision.
  // When closed, fall back to the bg count so badge is never stale.
  const totalUnread = liveUnreadCount;

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node))
        setAlertsOpen(false);
    }
    if (alertsOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [alertsOpen]);

  const segments = pathname.split("/").filter(Boolean);
  let pageTitle = PAGE_TITLES[pathname];
  if (!pageTitle) {
    if (segments[0] === "watchers" && segments[1]) {
      pageTitle = "Watchers Detail";
    } else if (segments[0] === "stocks" && segments[1]) {
      pageTitle = segments[1].toUpperCase();
    } else {
      pageTitle = segments[segments.length - 1] ?? "Page";
    }
  }

  const statusColor =
    wsStatus === "connected"
      ? "bg-positive"
      : wsStatus === "connecting"
        ? "bg-warning animate-pulse"
        : "bg-danger";

  function handleOpen() {
    setAlertsOpen(true);
    setAlertTab(totalUnread > 0 ? "unread" : "all");
  }

  function markAllRead() {
    markAllLiveRead();
    const unreadIds = unreadRestAlerts.map((a) => a.id);
    if (unreadIds.length > 0) markReadMut.mutate(unreadIds);
    // Optimistically clear bg count
    qc.setQueryData<Alert[]>(["alerts-unread-bg"], []);
  }

  const displayAlerts =
    alertTab === "unread"
      ? [
          ...liveAlerts.filter((a) => !a.read).slice(0, 10),
          ...unreadRestAlerts.slice(0, 10),
        ]
      : [...liveAlerts.slice(0, 5), ...allRestAlerts.slice(0, 10)];

  return (
    <header className="flex items-center justify-between px-3 md:px-5 py-2 md:py-2.5 sticky top-0 z-20 bg-bg/85 backdrop-blur-md border-b border-border shrink-0">
      {/* Left: Page title */}
      <h1 className="text-sm md:text-base font-semibold text-fg tracking-wide bg-elevated py-1.5 px-4 rounded-full">
        {pageTitle}
      </h1>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* WS status */}
        <div className="hidden sm:flex items-center gap-2 text-muted bg-elevated py-1.5 px-3 rounded-full text-xs">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="capitalize hidden md:inline">{wsStatus}</span>
        </div>

        {/* Clock */}
        {/* Refresh */}
        <button
          onClick={() => refreshMut.mutate()}
          disabled={refreshMut.isPending}
          title="Refresh market data"
          className="p-2 rounded-full bg-elevated hover:bg-surface2 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={`text-fg ${refreshMut.isPending ? "animate-spin" : ""}`}
          />
        </button>
        <div className="hidden sm:block font-mono text-xs text-muted bg-elevated py-1.5 px-3 rounded-full">
          {SOURCE_LABELS[priceSource] ?? priceSource}
        </div>
        {/* Alert bell */}
        <div ref={alertsRef} className="relative">
          <button
            onClick={handleOpen}
            className="relative p-2 rounded-full bg-elevated hover:bg-surface2 transition cursor-pointer"
          >
            <Bell size={14} className="text-fg" />
            {totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-danger text-bg rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 font-bold">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {alertsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <span className="text-sm font-semibold text-fg">
                  Notifications
                </span>
                <div className="flex items-center gap-2">
                  {totalUnread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <CheckCheck size={10} /> Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setAlertsOpen(false)}
                    className="text-faint hover:text-fg cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex px-3 pt-2 gap-1 shrink-0">
                {(["unread", "all"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAlertTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                      alertTab === tab
                        ? "bg-primary text-bg"
                        : "text-muted hover:text-fg hover:bg-elevated"
                    }`}
                  >
                    {tab}
                    {tab === "unread" && totalUnread > 0 && (
                      <span className="ml-1 text-[9px] bg-danger/20 text-danger rounded-full px-1">
                        {totalUnread}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Alert list */}
              <div className="flex-1 overflow-y-auto p-2 max-h-72">
                {displayAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Bell size={22} className="text-faint" />
                    <p className="text-xs text-faint">
                      No {alertTab === "unread" ? "unread " : ""}notifications
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {displayAlerts.map((alert) => {
                      const isLive = "read" in alert;
                      const isUnread = isLive
                        ? !(alert as (typeof liveAlerts)[0]).read
                        : !(alert as Alert).readAt;
                      const name =
                        "watchName" in alert
                          ? alert.watchName
                          : ((alert as any).watchName ?? "Alert");
                      const time = "firedAt" in alert ? alert.firedAt : "";
                      return (
                        <div
                          key={("id" in alert ? alert.id : "") + name}
                          className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition cursor-pointer ${
                            isUnread
                              ? "bg-warning/8 border border-warning/20"
                              : "hover:bg-elevated/50"
                          }`}
                          onClick={() => {
                            if (!("id" in alert)) return;
                            const watchId = alert.watchId;
                            const id = alert.id;
                            if (!watchId || !id) return;
                            markReadMut.mutate([id]);
                            router.push(`/watchers/${watchId}`);
                          }}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${isUnread ? "bg-warning" : "bg-transparent"}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-fg truncate">
                              {name}
                            </p>
                            {"currentValue" in alert &&
                              typeof alert.currentValue === "string" && (
                                <p className="text-[10px] text-muted truncate">
                                  {JSON.stringify(alert.currentValue)}
                                </p>
                              )}
                          </div>
                          <span className="text-[10px] text-faint shrink-0 flex items-center gap-0.5 mt-0.5">
                            <Clock size={9} />
                            {time
                              ? new Date(time).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <ThemeSwitcher />
      </div>
    </header>
  );
}
