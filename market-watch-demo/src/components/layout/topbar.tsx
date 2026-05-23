"use client";
import { usePathname } from "next/navigation";
import { Bell, X, CheckCheck, Clock, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/app";
import ThemeSwitcher from "./theme-switcher";
import CsvUploadModal from "./csv-upload-modal";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard", "/portfolio": "Portfolio", "/trades": "Trades",
  "/stocks": "Stocks", "/watchers": "Watchers", "/settings": "Settings",
};

export function TopBar() {
  const pathname = usePathname();
  const alerts = useAppStore(s => s.alerts);
  const setAlerts = useAppStore(s => s.setAlerts);
  const unreadAlerts = useAppStore(s => s.unreadAlerts);
  const csvUploadedAt = useAppStore(s => s.csvUploadedAt);

  const [alertsOpen, setAlertsOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const alertsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setAlertsOpen(false);
    }
    if (alertsOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [alertsOpen]);

  const segments = pathname.split("/").filter(Boolean);
  const pageTitle = PAGE_TITLES[pathname] ?? segments[segments.length - 1] ?? "Page";

  function markAllRead() {
    const { db } = require("@/lib/demo-store");
    db.markAllAlertsRead();
    const refreshAll = useAppStore.getState().refreshAll;
    refreshAll();
    setAlertsOpen(false);
  }

  return (
    <>
      <header className="flex items-center justify-between px-3 md:px-5 py-2 md:py-2.5 sticky top-0 z-20 bg-bg/85 backdrop-blur-md border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm md:text-base font-semibold text-fg tracking-wide bg-elevated py-1.5 px-4 rounded-full">
            {pageTitle}
          </h1>
          <span className="text-[10px] font-mono text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-full hidden sm:inline">
            DEMO
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* CSV upload indicator */}
          {csvUploadedAt && (
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-positive bg-positive/10 px-2.5 py-1.5 rounded-full">
              <span>CSV {new Date(csvUploadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )}

          {/* Upload CSV */}
          <button
            onClick={() => setCsvOpen(true)}
            title="Upload NEPSE CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-bg text-xs font-medium hover:bg-primary-strong transition cursor-pointer"
          >
            <Upload size={12} />
            <span className="hidden sm:inline">Upload CSV</span>
          </button>

          {/* Alert bell */}
          <div ref={alertsRef} className="relative">
            <button
              onClick={() => setAlertsOpen(!alertsOpen)}
              className="relative p-2 rounded-full bg-elevated hover:bg-surface2 transition cursor-pointer"
            >
              <Bell size={14} className="text-fg" />
              {unreadAlerts > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-danger text-bg rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 font-bold">
                  {unreadAlerts > 99 ? "99+" : unreadAlerts}
                </span>
              )}
            </button>

            {alertsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-sm font-semibold text-fg">Notifications</span>
                  <div className="flex items-center gap-2">
                    {unreadAlerts > 0 && (
                      <button onClick={markAllRead} className="text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-1">
                        <CheckCheck size={10} /> Mark all read
                      </button>
                    )}
                    <button onClick={() => setAlertsOpen(false)} className="text-faint hover:text-fg cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 max-h-72">
                  {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Bell size={22} className="text-faint" />
                      <p className="text-xs text-faint">No notifications</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {alerts.map(alert => (
                        <div
                          key={alert.id}
                          className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl ${
                            !alert.read ? "bg-warning/8 border border-warning/20" : "hover:bg-elevated/50"
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${!alert.read ? "bg-warning" : "bg-transparent"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-fg truncate">{alert.watchName}</p>
                            <p className="text-[10px] text-muted">{alert.conditionLabel} — {alert.value}</p>
                          </div>
                          <span className="text-[10px] text-faint shrink-0 flex items-center gap-0.5 mt-0.5">
                            <Clock size={9} />
                            {new Date(alert.firedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <ThemeSwitcher />
        </div>
      </header>

      <CsvUploadModal open={csvOpen} onClose={() => setCsvOpen(false)} />
    </>
  );
}
