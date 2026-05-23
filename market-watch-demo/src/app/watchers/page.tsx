"use client";
import { useAppStore } from "@/store/app";
import { formatDate } from "@/lib/utils";
import { LockedBanner } from "@/components/layout/demo-banner";
import {
  Radio,
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Lock,
} from "lucide-react";
import { useState } from "react";

type Tab = "watches" | "alerts";

export default function WatchersPage() {
  const watches = useAppStore((s) => s.watches);
  const alerts = useAppStore((s) => s.alerts);
  const [tab, setTab] = useState<Tab>("watches");

  return (
    <div className="flex flex-col gap-4 pb-10 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-2xl p-1">
          <TabBtn
            active={tab === "watches"}
            onClick={() => setTab("watches")}
            icon={<Radio size={13} />}
            label="Watches"
          />
          <TabBtn
            active={tab === "alerts"}
            onClick={() => setTab("alerts")}
            icon={<Bell size={13} />}
            label="Alerts"
          />
        </div>

        {/* Locked CTA */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-elevated border border-border rounded-xl text-[11px] text-faint">
          <Lock size={11} /> New Watch — local build only
        </div>
      </div>

      {/* Demo note */}
      <div className="flex items-start gap-3 px-4 py-3 bg-elevated border border-border rounded-xl text-xs text-muted">
        <Lock size={13} className="shrink-0 mt-0.5 text-faint" />
        <p>
          This tab shows{" "}
          <strong className="text-fg">read-only sample data</strong>. Creating,
          editing, and running watchers requires the backend (WebSocket +
          scheduler). Clone the repo to run the full watcher engine.
        </p>
      </div>

      {tab === "watches" && (
        <div className="flex flex-col gap-3">
          {watches.map((w) => (
            <div
              key={w.id}
              className={`bg-surface border rounded-2xl p-4 ${w.enabled ? "border-border" : "border-border/40 opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${w.enabled ? "bg-primary/10 text-primary" : "bg-elevated text-faint"}`}
                  >
                    <Radio size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg truncate">
                      {w.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="text-[10px] text-faint font-mono uppercase">
                        {w.engine}
                      </span>
                      {w.symbol && (
                        <span className="text-[10px] text-muted font-mono">
                          {w.symbol}
                        </span>
                      )}
                      <span className="text-[10px] text-muted">
                        {w.conditionLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${
                      w.enabled
                        ? "bg-positive/10 text-positive"
                        : "bg-elevated text-faint"
                    }`}
                  >
                    {w.enabled ? (
                      <CheckCircle2 size={10} />
                    ) : (
                      <XCircle size={10} />
                    )}
                    {w.enabled ? "Active" : "Off"}
                  </span>
                </div>
              </div>

              {(w.lastCheckedAt || w.lastAlertAt) && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 text-[10px] text-faint">
                  {w.lastCheckedAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={9} />
                      Checked{" "}
                      {new Date(w.lastCheckedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {w.lastAlertAt && (
                    <span className="flex items-center gap-1 text-warning">
                      <Bell size={9} />
                      Alerted{" "}
                      {new Date(w.lastAlertAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Full feature promo */}
          <div className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
            <Plus size={20} className="text-faint" />
            <div>
              <p className="text-sm font-medium text-fg">
                Create Condition-Based Watchers
              </p>
              <p className="text-xs text-muted mt-1 max-w-xs">
                Monitor prices, web pages, or custom APIs with 17 condition
                types. Fires alerts via Discord, Slack, ntfy, Telegram, and
                more.
              </p>
            </div>
            <a
              href="https://github.com/wormcracker/market-watch#installation"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-primary text-bg rounded-xl text-xs font-medium hover:bg-primary-strong transition"
            >
              Set up locally →
            </a>
          </div>
        </div>
      )}

      {tab === "alerts" && (
        <div className="flex flex-col gap-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`bg-surface border rounded-2xl px-4 py-3 flex items-start gap-3 ${
                !a.read ? "border-warning/30 bg-warning/5" : "border-border"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!a.read ? "bg-warning" : "bg-transparent"}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-fg">{a.watchName}</p>
                <p className="text-[10px] text-muted mt-0.5">
                  {a.conditionLabel} — value: {a.value}
                </p>
              </div>
              <span className="text-[10px] text-faint shrink-0 flex items-center gap-1 mt-0.5">
                <Clock size={9} />
                {new Date(a.firedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Bell size={24} className="text-faint" />
              <p className="text-sm text-faint">No alerts yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
        active
          ? "bg-primary text-bg shadow-sm"
          : "text-muted hover:text-fg hover:bg-elevated"
      }`}
    >
      {icon} {label}
    </button>
  );
}
