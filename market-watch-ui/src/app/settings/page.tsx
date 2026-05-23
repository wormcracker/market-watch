"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  Radio,
  BarChart3,
  Activity,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
  Gauge,
  X,
  Server,
  Cpu,
  Clock,
  Zap,
  Database,
  TrendingUp,
  CircleDot,
  AlertTriangle,
  MemoryStick,
  Timer,
  RefreshCw,
} from "lucide-react";
import { useQueryTab } from "@/hooks/useQueryTab";
import { Suspense } from "react";

// ─── Types ────────────────────────────────────────────────────
interface WatcherSettings {
  defaultIntervalSec: number;
  jitterFraction: number;
  maxConcurrent: number;
  perDomainDelayMs: number;
  requestTimeoutSec: number;
  alertCooldownSec: number;
  maxAlerts: number;
  maxHistory: number;
  notifPersists: boolean;
  macBackend: "osascript" | "node-notifier";
  truncate: boolean;
  truncateLen: number;
  osTemplate: string | null;
  notifTemplate: string | null;
  osNotifications: boolean;
  playSound: boolean;
  macSound: string;
  macVolumeLevel: number;
  customSound: string | null;
  customVolumeLevel: number;
  enabledChannels: {
    webhook: boolean;
    ntfy: boolean;
    discord: boolean;
    slack: boolean;
    telegram: boolean;
  };
  notifications: {
    webhook: string | null;
    discord: string | null;
    slack: string | null;
    ntfy: string | null;
    telegram: { token: string; chatId: string } | null;
  };
}

interface StockManagementConfig {
  spreadsheetId: string;
  links: { infoUrl: string; chartUrl: string; nepseInfoUrl: string };
  marginStocks: string[];
  marginColor: string;
  stockSecurityMap: Record<string, string>;
}

type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type TimeString = string;
interface SchedulerSlot {
  market_start: TimeString;
  market_end: TimeString;
  market_days: WeekDay[];
  interval: number;
}
interface SchedulerSubSlot {
  start: TimeString;
  end: TimeString;
  interval: number;
  order: string[];
}
interface NepseDataSetting {
  interval: number;
  shutdown: boolean;
  fallback_order: string[];
  fallback_order_after_market: string[];
  retry_count: number;
  retry_delay_ms: number;
  timeout_per_req_ms: number;
  status_check: boolean;
  status_recheck_interval_min: number;
  cache_ttl: number;
  scheduler: SchedulerSlot[];
  scheduler_sub_slots: SchedulerSubSlot[];
}

// ─── Status response types ────────────────────────────────────
interface NepseStatusData {
  scheduler: {
    isRunning: boolean;
    intervalSeconds: number;
    totalRuns: number;
    totalFailures: number;
    successRate: string;
    lastRunAt: string | null;
    nextRunAt: string | null;
  };
  orchestrator: {
    currentOrder: string[];
    marketStatus: boolean | null;
    isInsideMarketWindow: boolean;
  };
  cache: {
    exists: boolean;
    stale: boolean;
    ageSeconds?: number;
  };
  server: {
    uptime: string;
    memory: number;
    nodeVersion: string;
  };
}

interface WatcherStatusData {
  scheduler: {
    isRunning: boolean;
    running: number;
    pending: number;
    activeWatches: Array<{
      id: string;
      name: string;
      intervalSec: number;
      nextRunAt: string | null;
      nextRunInSec: number | null;
    }>;
  };
  watches: {
    total: number;
    enabled: number;
    byEngine: { http: number; puppeteer: number; nepse: number };
  };
  alerts: { total: number; unread: number };
  engines: {
    nepse: { connected: boolean; cacheAge: number | null; symbols: number };
  };
}

interface StockStatusData {
  uptime: number;
  timestamp: string;
  preloadStatus: Record<string, unknown>;
  ltp: { symbols: number; cache: Record<string, unknown> };
  memory: { rss: number; heapUsed: number; heapTotal: number };
}

interface AllStatus {
  nepse: NepseStatusData | null;
  watchers: WatcherStatusData | null;
  stocks: StockStatusData | null;
}

type Tab = "watchers" | "stocks" | "nepse";

// ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const [tab, setTab] = useQueryTab<Tab>(
    ["watchers", "stocks", "nepse"],
    "watchers",
  );
  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 pb-10 max-w-screen-xl mx-auto w-full page-enter">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-2xl p-1 w-fit flex-wrap">
        <TabBtn
          active={tab === "watchers"}
          onClick={() => setTab("watchers")}
          icon={<Radio size={13} />}
          label="Watchers"
        />
        <TabBtn
          active={tab === "stocks"}
          onClick={() => setTab("stocks")}
          icon={<BarChart3 size={13} />}
          label="Stock Management"
        />
        <TabBtn
          active={tab === "nepse"}
          onClick={() => setTab("nepse")}
          icon={<Activity size={13} />}
          label="NEPSE Data"
        />
      </div>

      <div key={tab} className="tab-panel">
        {tab === "watchers" && (
          <WatcherSettingsTab onStatusClick={() => setStatusOpen(true)} />
        )}
        {tab === "stocks" && (
          <StockSettingsTab onStatusClick={() => setStatusOpen(true)} />
        )}
        {tab === "nepse" && (
          <NepseSettingsTab onStatusClick={() => setStatusOpen(true)} />
        )}
      </div>

      {statusOpen && <StatusModal onClose={() => setStatusOpen(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  STATUS MODAL
// ─────────────────────────────────────────────────────────────
function StatusModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<AllStatus>({
    nepse: null,
    watchers: null,
    stocks: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const [nepse, watchers, stocks] = await Promise.all([
        apiFetch<NepseStatusData>("nepse/status").catch(() => null),
        apiFetch<WatcherStatusData>("watchers/system/status").catch(() => null),
        apiFetch<StockStatusData>("stocks/status").catch(() => null),
      ]);
      setStatus({ nepse, watchers, stocks });
      setLastFetched(new Date());
    } catch {
      setError("Failed to fetch status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-surface border border-border rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-primary/10">
              <Gauge size={15} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-fg">System Status</h2>
              {lastFetched && (
                <p className="text-[10px] text-faint">
                  Updated {lastFetched.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAll}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted hover:text-fg hover:border-fg/20 transition cursor-pointer disabled:opacity-40"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-elevated text-faint hover:text-fg transition cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5">
          {loading && !status.nepse && !status.watchers && !status.stocks ? (
            <StatusSkeleton />
          ) : error ? (
            <div className="flex items-center gap-2 p-4 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
              <AlertTriangle size={14} /> {error}
            </div>
          ) : (
            <>
              <NepseStatusSection data={status.nepse} />
              <WatcherStatusSection data={status.watchers} />
              <StockStatusSection data={status.stocks} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NEPSE Status Section ─────────────────────────────────────
function NepseStatusSection({ data }: { data: NepseStatusData | null }) {
  return (
    <StatusSection
      title="NEPSE Data"
      icon={<Activity size={13} />}
      color="text-sky-400"
      missing={!data}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<CircleDot size={13} />}
              label="Scheduler"
              value={data.scheduler.isRunning ? "Running" : "Stopped"}
              valueClass={
                data.scheduler.isRunning ? "text-positive" : "text-danger"
              }
            />
            <StatCard
              icon={<TrendingUp size={13} />}
              label="Success Rate"
              value={data.scheduler.successRate}
              valueClass="text-fg"
            />
            <StatCard
              icon={<Zap size={13} />}
              label="Total Runs"
              value={String(data.scheduler.totalRuns)}
              sub={`${data.scheduler.totalFailures} failed`}
              valueClass="text-fg"
            />
            <StatCard
              icon={<Timer size={13} />}
              label="Interval"
              value={`${data.scheduler.intervalSeconds}s`}
              valueClass="text-fg"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
            <StatCard
              icon={<Database size={13} />}
              label="Market Status"
              value={
                data.orchestrator.marketStatus === null
                  ? "Unknown"
                  : data.orchestrator.marketStatus
                    ? "Open"
                    : "Closed"
              }
              valueClass={
                data.orchestrator.marketStatus === true
                  ? "text-positive"
                  : data.orchestrator.marketStatus === false
                    ? "text-danger"
                    : "text-muted"
              }
            />
            <StatCard
              icon={<Zap size={13} />}
              label="In Market Window"
              value={data.orchestrator.isInsideMarketWindow ? "Yes" : "No"}
              valueClass={
                data.orchestrator.isInsideMarketWindow
                  ? "text-positive"
                  : "text-muted"
              }
            />
            <StatCard
              icon={<Database size={13} />}
              label="Cache"
              value={
                !data.cache.exists
                  ? "Empty"
                  : data.cache.stale
                    ? "Stale"
                    : "Fresh"
              }
              sub={
                data.cache.ageSeconds != null
                  ? `${Math.round(data.cache.ageSeconds)}s old`
                  : undefined
              }
              valueClass={
                !data.cache.exists
                  ? "text-faint"
                  : data.cache.stale
                    ? "text-amber-400"
                    : "text-positive"
              }
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
            <StatCard
              icon={<Server size={13} />}
              label="Uptime"
              value={data.server.uptime}
              valueClass="text-fg"
            />
            <StatCard
              icon={<MemoryStick size={13} />}
              label="Memory (heap)"
              value={formatBytes(data.server.memory)}
              valueClass="text-fg"
            />
            <StatCard
              icon={<Cpu size={13} />}
              label="Source Order"
              value={data.orchestrator.currentOrder.join(" → ")}
              valueClass="text-fg text-[10px]"
            />
          </div>

          <TimestampRow
            label="Last run"
            value={data.scheduler.lastRunAt}
            label2="Next run"
            value2={data.scheduler.nextRunAt}
          />
        </>
      )}
    </StatusSection>
  );
}

// ─── Watcher Status Section ───────────────────────────────────
function WatcherStatusSection({ data }: { data: WatcherStatusData | null }) {
  return (
    <StatusSection
      title="Watchers"
      icon={<Radio size={13} />}
      color="text-violet-400"
      missing={!data}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<CircleDot size={13} />}
              label="Scheduler"
              value={data.scheduler.isRunning ? "Running" : "Stopped"}
              valueClass={
                data.scheduler.isRunning ? "text-positive" : "text-danger"
              }
            />
            <StatCard
              icon={<Radio size={13} />}
              label="Watches"
              value={`${data.watches.enabled} / ${data.watches.total}`}
              sub="enabled / total"
              valueClass="text-fg"
            />
            <StatCard
              icon={<AlertCircle size={13} />}
              label="Alerts"
              value={String(data.alerts.total)}
              sub={`${data.alerts.unread} unread`}
              valueClass={data.alerts.unread > 0 ? "text-amber-400" : "text-fg"}
            />
            <StatCard
              icon={<Zap size={13} />}
              label="NEPSE Engine"
              value={
                data.engines.nepse.connected ? "Connected" : "Disconnected"
              }
              sub={
                data.engines.nepse.symbols > 0
                  ? `${data.engines.nepse.symbols} symbols`
                  : undefined
              }
              valueClass={
                data.engines.nepse.connected ? "text-positive" : "text-danger"
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mt-1">
            <StatCard
              icon={<Activity size={13} />}
              label="HTTP Watches"
              value={String(data.watches.byEngine.http)}
              valueClass="text-fg"
            />
            <StatCard
              icon={<Activity size={13} />}
              label="Puppeteer Watches"
              value={String(data.watches.byEngine.puppeteer)}
              valueClass="text-fg"
            />
            <StatCard
              icon={<Activity size={13} />}
              label="NEPSE Watches"
              value={String(data.watches.byEngine.nepse)}
              valueClass="text-fg"
            />
          </div>

          {data.scheduler.activeWatches?.length > 0 && (
            <div className="mt-1">
              <p className="text-[10px] text-faint uppercase tracking-wide mb-2">
                Active Watches
              </p>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                {data.scheduler.activeWatches.slice(0, 8).map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between px-3 py-2 bg-bg border border-border/50 rounded-xl"
                  >
                    <span className="text-xs font-medium text-fg truncate flex-1 mr-3">
                      {w.name}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-muted font-mono">
                        {w.intervalSec}s
                      </span>
                      {w.nextRunInSec != null && (
                        <span
                          className={`text-[10px] font-mono ${w.nextRunInSec <= 10 ? "text-amber-400" : "text-faint"}`}
                        >
                          in {w.nextRunInSec}s
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.engines.nepse.cacheAge != null && (
            <StatCard
              icon={<Clock size={13} />}
              label="NEPSE Cache Age"
              value={`${Math.round(data.engines.nepse.cacheAge / 1000)}s`}
              valueClass="text-fg"
            />
          )}
        </>
      )}
    </StatusSection>
  );
}

// ─── Stock Status Section ─────────────────────────────────────
function StockStatusSection({ data }: { data: StockStatusData | null }) {
  return (
    <StatusSection
      title="Stock Management"
      icon={<BarChart3 size={13} />}
      color="text-emerald-400"
      missing={!data}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Clock size={13} />}
              label="Uptime"
              value={formatUptime(data.uptime)}
              valueClass="text-fg"
            />
            <StatCard
              icon={<Database size={13} />}
              label="LTP Symbols"
              value={String(data.ltp.symbols)}
              valueClass={data.ltp.symbols > 0 ? "text-positive" : "text-muted"}
            />
            <StatCard
              icon={<MemoryStick size={13} />}
              label="Heap Used"
              value={formatBytes(data.memory.heapUsed)}
              sub={`of ${formatBytes(data.memory.heapTotal)}`}
              valueClass="text-fg"
            />
            <StatCard
              icon={<Server size={13} />}
              label="RSS"
              value={formatBytes(data.memory.rss)}
              valueClass="text-fg"
            />
          </div>

          {/* Memory usage bar */}
          <div className="mt-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-faint">Heap Usage</p>
              <p className="text-[10px] text-faint font-mono">
                {Math.round(
                  (data.memory.heapUsed / data.memory.heapTotal) * 100,
                )}
                %
              </p>
            </div>
            <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (data.memory.heapUsed / data.memory.heapTotal) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Preload status */}
          {data.preloadStatus && Object.keys(data.preloadStatus).length > 0 && (
            <div className="mt-1">
              <p className="text-[10px] text-faint uppercase tracking-wide mb-2">
                Preload Status
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.preloadStatus).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg border border-border/50 rounded-xl"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${v ? "bg-positive" : "bg-danger"}`}
                    />
                    <span className="text-[10px] text-muted font-mono">
                      {k}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-faint mt-1">
            Last checked:{" "}
            <span className="text-muted">
              {new Date(data.timestamp).toLocaleTimeString()}
            </span>
          </p>
        </>
      )}
    </StatusSection>
  );
}

// ─── Section wrapper ──────────────────────────────────────────
function StatusSection({
  title,
  icon,
  color,
  missing,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  missing: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg border border-border rounded-2xl overflow-hidden">
      <div
        className={`flex items-center gap-2 px-5 py-3.5 border-b border-border/60`}
      >
        <span className={color}>{icon}</span>
        <span className="text-sm font-semibold text-fg">{title}</span>
        {missing && (
          <span className="ml-auto text-[10px] text-faint flex items-center gap-1">
            <AlertTriangle size={10} className="text-amber-400" /> No data
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass = "text-fg",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-surface border border-border/50 rounded-xl px-3 py-3">
      <div className="flex items-center gap-1.5 text-faint">{icon}</div>
      <p
        className={`text-sm font-semibold leading-tight truncate ${valueClass}`}
      >
        {value}
      </p>
      <p className="text-[10px] text-faint leading-none">{label}</p>
      {sub && <p className="text-[10px] text-faint/70 leading-none">{sub}</p>}
    </div>
  );
}

// ─── Timestamp row ────────────────────────────────────────────
function TimestampRow({
  label,
  value,
  label2,
  value2,
}: {
  label: string;
  value: string | null;
  label2: string;
  value2: string | null;
}) {
  return (
    <div className="flex items-center gap-4 px-3 py-2 bg-bg border border-border/40 rounded-xl">
      <div className="flex items-center gap-1.5">
        <Clock size={10} className="text-faint" />
        <span className="text-[10px] text-faint">{label}:</span>
        <span className="text-[10px] text-muted font-mono">
          {value ? new Date(value).toLocaleTimeString() : "—"}
        </span>
      </div>
      <div className="w-px h-3 bg-border" />
      <div className="flex items-center gap-1.5">
        <Timer size={10} className="text-faint" />
        <span className="text-[10px] text-faint">{label2}:</span>
        <span className="text-[10px] text-muted font-mono">
          {value2 ? new Date(value2).toLocaleTimeString() : "—"}
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────
function StatusSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-bg border border-border rounded-2xl overflow-hidden"
        >
          <div className="h-11 border-b border-border/60 bg-surface animate-pulse" />
          <div className="p-4 grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((j) => (
              <div
                key={j}
                className="h-16 bg-surface border border-border/50 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

// ─────────────────────────────────────────────────────────────
//  STATUS BUTTON  (shown in each tab's toolbar)
// ─────────────────────────────────────────────────────────────
function StatusButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs text-muted bg-surface hover:text-fg hover:border-fg/20 hover:bg-elevated transition cursor-pointer"
    >
      <Gauge size={12} />
      Status
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
//  WATCHERS SETTINGS
// ─────────────────────────────────────────────────────────────
function WatcherSettingsTab({ onStatusClick }: { onStatusClick: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<WatcherSettings | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  const { data, isLoading } = useQuery<WatcherSettings>({
    queryKey: ["watcher-settings"],
    queryFn: () => apiFetch<WatcherSettings>("watchers/settings"),
  });

  useEffect(() => {
    if (data && !form) setForm(structuredClone(data));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (body: WatcherSettings) => apiPatch("watchers/settings", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watcher-settings"] });
      showMsg("ok", "Settings saved");
    },
    onError: (e) => showMsg("err", e.message),
  });

  const resetMut = useMutation({
    mutationFn: () => apiPost("watchers/settings/reset"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watcher-settings"] });
      setForm(null);
      showMsg("ok", "Reset to defaults");
    },
    onError: (e) => showMsg("err", e.message),
  });

  function showMsg(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  }

  function set<K extends keyof WatcherSettings>(
    key: K,
    val: WatcherSettings[K],
  ) {
    setForm((f) => (f ? { ...f, [key]: val } : f));
  }

  function setChannel(
    ch: keyof WatcherSettings["enabledChannels"],
    val: boolean,
  ) {
    setForm((f) =>
      f ? { ...f, enabledChannels: { ...f.enabledChannels, [ch]: val } } : f,
    );
  }

  function setNotif(ch: keyof WatcherSettings["notifications"], val: unknown) {
    setForm((f) =>
      f ? { ...f, notifications: { ...f.notifications, [ch]: val } } : f,
    );
  }

  if (isLoading || !form) return <SettingsLoader />;

  return (
    <div className="flex flex-col gap-4">
      <SettingsToolbar
        onSave={() => saveMut.mutate(form)}
        onReset={() => {
          if (confirm("Reset to defaults?")) resetMut.mutate();
        }}
        onStatus={onStatusClick}
        saving={saveMut.isPending}
        msg={msg}
      />

      <Section title="General" icon={<Radio size={13} />}>
        <Grid>
          <NumField
            label="Default Interval (sec)"
            hint="How often watchers run"
            value={form.defaultIntervalSec}
            onChange={(v) => set("defaultIntervalSec", v)}
          />
          <NumField
            label="Jitter Fraction"
            hint="Randomise interval (0–1)"
            value={form.jitterFraction}
            onChange={(v) => set("jitterFraction", v)}
            step={0.01}
            min={0}
            max={1}
          />
          <NumField
            label="Max Concurrent"
            hint="Parallel watcher runs"
            value={form.maxConcurrent}
            onChange={(v) => set("maxConcurrent", v)}
          />
          <NumField
            label="Per-Domain Delay (ms)"
            value={form.perDomainDelayMs}
            onChange={(v) => set("perDomainDelayMs", v)}
          />
          <NumField
            label="Request Timeout (sec)"
            value={form.requestTimeoutSec}
            onChange={(v) => set("requestTimeoutSec", v)}
          />
          <NumField
            label="Alert Cooldown (sec)"
            value={form.alertCooldownSec}
            onChange={(v) => set("alertCooldownSec", v)}
          />
          <NumField
            label="Max Alerts stored"
            value={form.maxAlerts}
            onChange={(v) => set("maxAlerts", v)}
          />
          <NumField
            label="Max History per watch"
            value={form.maxHistory}
            onChange={(v) => set("maxHistory", v)}
          />
        </Grid>
      </Section>

      <Section title="Notifications" icon={<Radio size={13} />}>
        <Grid>
          <Toggle
            label="OS Notifications"
            hint="System desktop alerts"
            value={form.osNotifications}
            onChange={(v) => set("osNotifications", v)}
          />
          <Toggle
            label="Notification Persists"
            value={form.notifPersists}
            onChange={(v) => set("notifPersists", v)}
          />
          <Toggle
            label="Play Sound"
            value={form.playSound}
            onChange={(v) => set("playSound", v)}
          />
          <Toggle
            label="Truncate values"
            value={form.truncate}
            onChange={(v) => set("truncate", v)}
          />
        </Grid>
        <Grid cols={2}>
          <SelectField
            label="Mac Backend"
            value={form.macBackend}
            options={["osascript", "node-notifier"]}
            onChange={(v) => set("macBackend", v as any)}
          />
          <MacSoundField
            value={form.macSound}
            onChange={(v) => set("macSound", v)}
          />
          <NumField
            label="Mac Volume (0–1)"
            value={form.macVolumeLevel}
            onChange={(v) => set("macVolumeLevel", v)}
            step={0.1}
            min={0}
            max={1}
          />
          {form.truncate && (
            <NumField
              label="Truncate Length"
              value={form.truncateLen}
              onChange={(v) => set("truncateLen", v)}
            />
          )}
          <CustomSoundField
            value={form.customSound ?? ""}
            onChange={(v) => set("customSound", v || null)}
          />
          <NumField
            label="Custom Volume (0–1)"
            value={form.customVolumeLevel}
            onChange={(v) => set("customVolumeLevel", v)}
            step={0.1}
            min={0}
            max={1}
          />
        </Grid>
        <Grid cols={1}>
          <TemplateField
            label="Notif Template"
            hint="Click chips to insert variables"
            value={form.notifTemplate ?? ""}
            onChange={(v) => set("notifTemplate", v || null)}
          />
          <TemplateField
            label="OS Template"
            hint="Click chips to insert variables"
            value={form.osTemplate ?? ""}
            onChange={(v) => set("osTemplate", v || null)}
          />
        </Grid>
      </Section>

      <Section title="Notification Channels" icon={<Radio size={13} />}>
        <Grid>
          {(["webhook", "ntfy", "discord", "slack", "telegram"] as const).map(
            (ch) => (
              <Toggle
                key={ch}
                label={ch.charAt(0).toUpperCase() + ch.slice(1)}
                value={form.enabledChannels[ch]}
                onChange={(v) => setChannel(ch, v)}
              />
            ),
          )}
        </Grid>
        <div className="flex flex-col gap-3 mt-2">
          {(["webhook", "discord", "slack", "ntfy"] as const).map(
            (ch) =>
              form.enabledChannels[ch] && (
                <TextField
                  key={ch}
                  label={`${ch.charAt(0).toUpperCase() + ch.slice(1)} URL`}
                  value={(form.notifications[ch] as string) ?? ""}
                  onChange={(v) => setNotif(ch, v || null)}
                  placeholder="https://…"
                />
              ),
          )}
          {form.enabledChannels.telegram && (
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Telegram Bot Token"
                value={form.notifications.telegram?.token ?? ""}
                onChange={(v) =>
                  setNotif("telegram", {
                    ...form.notifications.telegram,
                    token: v,
                  })
                }
                placeholder="123456:ABC…"
              />
              <TextField
                label="Telegram Chat ID"
                value={form.notifications.telegram?.chatId ?? ""}
                onChange={(v) =>
                  setNotif("telegram", {
                    ...form.notifications.telegram,
                    chatId: v,
                  })
                }
                placeholder="-100…"
              />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  STOCK MANAGEMENT SETTINGS
// ─────────────────────────────────────────────────────────────
function StockSettingsTab({ onStatusClick }: { onStatusClick: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<StockManagementConfig | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [newMargin, setNewMargin] = useState("");
  const [newMapKey, setNewMapKey] = useState("");
  const [newMapVal, setNewMapVal] = useState("");

  const { data, isLoading } = useQuery<StockManagementConfig>({
    queryKey: ["stock-settings"],
    queryFn: () => apiFetch<StockManagementConfig>("stocks/settings"),
  });

  useEffect(() => {
    if (data && !form) setForm(structuredClone(data));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (body: StockManagementConfig) =>
      apiPatch("stocks/settings", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-settings"] });
      showMsg("ok", "Settings saved");
    },
    onError: (e) => showMsg("err", e.message),
  });

  const resetMut = useMutation({
    mutationFn: () => apiPost("stocks/settings/reset"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-settings"] });
      setForm(null);
      showMsg("ok", "Reset to defaults");
    },
    onError: (e) => showMsg("err", e.message),
  });

  function showMsg(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  }
  function set<K extends keyof StockManagementConfig>(
    key: K,
    val: StockManagementConfig[K],
  ) {
    setForm((f) => (f ? { ...f, [key]: val } : f));
  }
  function setLink(key: keyof StockManagementConfig["links"], val: string) {
    setForm((f) => (f ? { ...f, links: { ...f.links, [key]: val } } : f));
  }

  function addMargin() {
    const sym = newMargin.trim().toUpperCase();
    if (!sym || !form) return;
    set("marginStocks", [...(form.marginStocks ?? []), sym]);
    setNewMargin("");
  }
  function removeMargin(sym: string) {
    setForm((f) =>
      f ? { ...f, marginStocks: f.marginStocks.filter((s) => s !== sym) } : f,
    );
  }
  function addMap() {
    const k = newMapKey.trim().toUpperCase();
    const v = newMapVal.trim();
    if (!k || !v || !form) return;
    set("stockSecurityMap", { ...form.stockSecurityMap, [k]: v });
    setNewMapKey("");
    setNewMapVal("");
  }
  function removeMap(key: string) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f.stockSecurityMap };
      delete next[key];
      return { ...f, stockSecurityMap: next };
    });
  }

  if (isLoading || !form) return <SettingsLoader />;

  return (
    <div className="flex flex-col gap-4">
      <SettingsToolbar
        onSave={() => saveMut.mutate(form)}
        onReset={() => {
          if (confirm("Reset to defaults?")) resetMut.mutate();
        }}
        onStatus={onStatusClick}
        saving={saveMut.isPending}
        msg={msg}
      />

      <Section title="Google Sheets" icon={<BarChart3 size={13} />}>
        <TextField
          label="Spreadsheet ID"
          hint="From the Google Sheets URL"
          value={form.spreadsheetId}
          onChange={(v) => set("spreadsheetId", v)}
          placeholder="1BxiMVs0XRA…"
        />
        <Grid cols={1} className="mt-3">
          <TextField
            label="Info URL"
            value={form.links?.infoUrl ?? ""}
            onChange={(v) => setLink("infoUrl", v)}
            placeholder="https://…"
          />
          <TextField
            label="Chart URL"
            value={form.links?.chartUrl ?? ""}
            onChange={(v) => setLink("chartUrl", v)}
            placeholder="https://…"
          />
          <TextField
            label="NEPSE Info URL"
            value={form.links?.nepseInfoUrl ?? ""}
            onChange={(v) => setLink("nepseInfoUrl", v)}
            placeholder="https://…"
          />
        </Grid>
      </Section>

      <Section
        title="Margin Stocks"
        icon={<BarChart3 size={13} />}
        hint="Symbols that support margin trading"
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {(form.marginStocks ?? []).map((sym) => (
            <div
              key={sym}
              className="flex items-center gap-1.5 bg-elevated border border-border px-2.5 py-1 rounded-xl"
            >
              <span className="text-xs font-mono font-semibold text-fg">
                {sym}
              </span>
              <button
                onClick={() => removeMargin(sym)}
                className="text-faint hover:text-danger cursor-pointer transition"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
          {(form.marginStocks ?? []).length === 0 && (
            <p className="text-xs text-faint italic">
              No margin stocks configured
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newMargin}
            onChange={(e) => setNewMargin(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addMargin()}
            placeholder="SYMBOL"
            className={inputCls + " max-w-32"}
          />
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted">Margin Color</label>
            <input
              type="color"
              value={form.marginColor ?? "#f59e0b"}
              onChange={(e) => set("marginColor", e.target.value)}
              className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-elevated"
            />
            <span className="text-[10px] font-mono text-faint">
              {form.marginColor}
            </span>
          </div>
          <button
            onClick={addMargin}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-bg rounded-xl text-xs font-semibold cursor-pointer hover:bg-primary-strong transition"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </Section>

      <Section
        title="Stock Security Map"
        icon={<BarChart3 size={13} />}
        hint="Maps stock symbols to security identifiers"
      >
        <div className="flex flex-col gap-1.5 mb-3 max-h-48 overflow-y-auto">
          {Object.entries(form.stockSecurityMap ?? {}).length === 0 ? (
            <p className="text-xs text-faint italic">No mappings configured</p>
          ) : (
            Object.entries(form.stockSecurityMap ?? {}).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-xl border border-border/50"
              >
                <span className="text-xs font-mono font-semibold text-fg w-24 shrink-0">
                  {k}
                </span>
                <span className="text-faint">→</span>
                <span className="text-xs font-mono text-muted flex-1 truncate">
                  {v}
                </span>
                <button
                  onClick={() => removeMap(k)}
                  className="text-faint hover:text-danger cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newMapKey}
            onChange={(e) => setNewMapKey(e.target.value.toUpperCase())}
            placeholder="SYMBOL"
            className={inputCls + " w-28"}
          />
          <span className="text-faint text-sm">→</span>
          <input
            value={newMapVal}
            onChange={(e) => setNewMapVal(e.target.value)}
            placeholder="security-id"
            className={inputCls + " flex-1"}
          />
          <button
            onClick={addMap}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-bg rounded-xl text-xs font-semibold cursor-pointer hover:bg-primary-strong transition shrink-0"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  NEPSE DATA SETTINGS
// ─────────────────────────────────────────────────────────────
const DATA_SOURCES = ["chukul", "merolagani", "memory_cache", "disk_cache"];
const WEEK_DAYS: { label: string; val: WeekDay }[] = [
  { label: "Sun", val: 0 },
  { label: "Mon", val: 1 },
  { label: "Tue", val: 2 },
  { label: "Wed", val: 3 },
  { label: "Thu", val: 4 },
  { label: "Fri", val: 5 },
  { label: "Sat", val: 6 },
];

function NepseSettingsTab({ onStatusClick }: { onStatusClick: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<NepseDataSetting | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  const { data, isLoading } = useQuery<NepseDataSetting>({
    queryKey: ["nepse-settings"],
    queryFn: () => apiFetch<NepseDataSetting>("nepse/settings"),
  });

  useEffect(() => {
    if (data && !form) setForm(structuredClone(data));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (body: NepseDataSetting) => apiPatch("nepse/settings", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nepse-settings"] });
      showMsg("ok", "Settings saved");
    },
    onError: (e) => showMsg("err", e.message),
  });

  function showMsg(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  }
  function set<K extends keyof NepseDataSetting>(
    key: K,
    val: NepseDataSetting[K],
  ) {
    setForm((f) => (f ? { ...f, [key]: val } : f));
  }

  function moveFallback(
    arr: string[],
    from: number,
    to: number,
    setter: (v: string[]) => void,
  ) {
    if (to < 0 || to >= arr.length) return;
    const next = [...arr];
    [next[from], next[to]] = [next[to], next[from]];
    setter(next);
  }

  function addSlot() {
    setForm((f) =>
      f
        ? {
            ...f,
            scheduler: [
              ...f.scheduler,
              {
                market_start: "11:00",
                market_end: "15:00",
                market_days: [1, 2, 3, 4, 5],
                interval: 30,
              },
            ],
          }
        : f,
    );
  }
  function updateSlot(i: number, patch: Partial<SchedulerSlot>) {
    setForm((f) => {
      if (!f) return f;
      const next = [...f.scheduler];
      next[i] = { ...next[i], ...patch };
      return { ...f, scheduler: next };
    });
  }
  function removeSlot(i: number) {
    setForm((f) =>
      f ? { ...f, scheduler: f.scheduler.filter((_, si) => si !== i) } : f,
    );
  }
  function addSubSlot() {
    setForm((f) =>
      f
        ? {
            ...f,
            scheduler_sub_slots: [
              ...f.scheduler_sub_slots,
              {
                start: "11:00",
                end: "12:00",
                interval: 15,
                order: ["chukul", "merolagani"],
              },
            ],
          }
        : f,
    );
  }
  function updateSubSlot(i: number, patch: Partial<SchedulerSubSlot>) {
    setForm((f) => {
      if (!f) return f;
      const next = [...f.scheduler_sub_slots];
      next[i] = { ...next[i], ...patch };
      return { ...f, scheduler_sub_slots: next };
    });
  }
  function removeSubSlot(i: number) {
    setForm((f) =>
      f
        ? {
            ...f,
            scheduler_sub_slots: f.scheduler_sub_slots.filter(
              (_, si) => si !== i,
            ),
          }
        : f,
    );
  }

  if (isLoading || !form) return <SettingsLoader />;

  return (
    <div className="flex flex-col gap-4">
      <SettingsToolbar
        onSave={() => saveMut.mutate(form)}
        onReset={undefined}
        onStatus={onStatusClick}
        saving={saveMut.isPending}
        msg={msg}
      />

      <Section title="Core Settings" icon={<Activity size={13} />}>
        <Grid>
          <Toggle
            label="Shutdown"
            value={form.shutdown}
            onChange={(v) => set("shutdown", v)}
          />
          <NumField
            label="Fetch Interval (sec)"
            value={form.interval}
            onChange={(v) => set("interval", v)}
          />
          <NumField
            label="Retry Count"
            value={form.retry_count}
            onChange={(v) => set("retry_count", v)}
          />
          <NumField
            label="Retry Delay (ms)"
            value={form.retry_delay_ms}
            onChange={(v) => set("retry_delay_ms", v)}
          />
          <NumField
            label="Timeout per Request (ms)"
            value={form.timeout_per_req_ms}
            onChange={(v) => set("timeout_per_req_ms", v)}
          />
          <NumField
            label="Cache TTL (sec)"
            value={form.cache_ttl}
            onChange={(v) => set("cache_ttl", v)}
          />
          <NumField
            label="Status Recheck Interval (min)"
            value={form.status_recheck_interval_min}
            onChange={(v) => set("status_recheck_interval_min", v)}
          />
          <Toggle
            label="Status Check"
            value={form.status_check}
            onChange={(v) => set("status_check", v)}
          />
        </Grid>
      </Section>

      <Section
        title="Data Source Fallback Order"
        icon={<Activity size={13} />}
        hint="Drag to reorder — left = highest priority"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { label: "Market Hours", key: "fallback_order" as const },
            {
              label: "After Market",
              key: "fallback_order_after_market" as const,
            },
          ].map(({ label, key }) => (
            <div key={key} className="flex flex-col gap-2">
              <p className="text-[10px] text-faint uppercase tracking-wide">
                {label}
              </p>
              <div className="flex flex-col gap-1.5">
                {(form[key] as string[]).map((src, i) => (
                  <div
                    key={src}
                    className="flex items-center gap-2 bg-elevated border border-border/50 rounded-xl px-3 py-2"
                  >
                    <span className="text-[9px] text-faint w-4">{i + 1}</span>
                    <span className="text-xs font-mono text-fg flex-1">
                      {src}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          moveFallback(form[key] as string[], i, i - 1, (v) =>
                            set(key, v as any),
                          )
                        }
                        disabled={i === 0}
                        className="text-faint hover:text-fg cursor-pointer disabled:opacity-30 text-[9px] px-1"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() =>
                          moveFallback(form[key] as string[], i, i + 1, (v) =>
                            set(key, v as any),
                          )
                        }
                        disabled={i === (form[key] as string[]).length - 1}
                        className="text-faint hover:text-fg cursor-pointer disabled:opacity-30 text-[9px] px-1"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {DATA_SOURCES.filter(
                  (s) => !(form[key] as string[]).includes(s),
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      set(key, [...(form[key] as string[]), s] as any)
                    }
                    className="text-[9px] px-2 py-0.5 bg-elevated border border-dashed border-border rounded-lg text-faint hover:text-fg cursor-pointer transition"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Market Scheduler Slots"
        icon={<Activity size={13} />}
        hint="Define when fetching is active"
      >
        <div className="flex flex-col gap-3">
          {form.scheduler.map((slot, i) => (
            <div
              key={i}
              className="bg-elevated border border-border/60 rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-fg">Slot {i + 1}</p>
                <button
                  onClick={() => removeSlot(i)}
                  className="text-faint hover:text-danger cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <Grid cols={3}>
                <Field label="Market Start">
                  <input
                    type="time"
                    value={slot.market_start}
                    onChange={(e) =>
                      updateSlot(i, { market_start: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Market End">
                  <input
                    type="time"
                    value={slot.market_end}
                    onChange={(e) =>
                      updateSlot(i, { market_end: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Interval (sec)">
                  <input
                    type="number"
                    value={slot.interval}
                    onChange={(e) =>
                      updateSlot(i, { interval: parseInt(e.target.value) })
                    }
                    className={inputCls}
                  />
                </Field>
              </Grid>
              <Field label="Market Days">
                <div className="flex gap-1.5 flex-wrap">
                  {WEEK_DAYS.map(({ label, val }) => {
                    const active = slot.market_days.includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() =>
                          updateSlot(i, {
                            market_days: active
                              ? slot.market_days.filter((d) => d !== val)
                              : ([
                                  ...slot.market_days,
                                  val,
                                ].sort() as WeekDay[]),
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${active ? "bg-primary/15 border-primary/30 text-primary" : "border-border text-faint hover:text-fg"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          ))}
          <button
            onClick={addSlot}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-dashed border-border rounded-xl text-xs text-muted hover:text-fg hover:border-fg/30 transition cursor-pointer w-fit"
          >
            <Plus size={12} /> Add Slot
          </button>
        </div>
      </Section>

      <Section
        title="Scheduler Sub-Slots"
        icon={<Activity size={13} />}
        hint="High-frequency windows within market hours"
      >
        <div className="flex flex-col gap-3">
          {form.scheduler_sub_slots.length === 0 && (
            <p className="text-xs text-faint italic">No sub-slots configured</p>
          )}
          {form.scheduler_sub_slots.map((slot, i) => (
            <div
              key={i}
              className="bg-elevated border border-border/60 rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-fg">
                  Sub-Slot {i + 1}
                </p>
                <button
                  onClick={() => removeSubSlot(i)}
                  className="text-faint hover:text-danger cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <Grid cols={3}>
                <Field label="Start">
                  <input
                    type="time"
                    value={slot.start}
                    onChange={(e) =>
                      updateSubSlot(i, { start: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="End">
                  <input
                    type="time"
                    value={slot.end}
                    onChange={(e) => updateSubSlot(i, { end: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Interval (sec)">
                  <input
                    type="number"
                    value={slot.interval}
                    onChange={(e) =>
                      updateSubSlot(i, { interval: parseInt(e.target.value) })
                    }
                    className={inputCls}
                  />
                </Field>
              </Grid>
              <Field label="Data Source Order">
                <div className="flex flex-wrap gap-1.5">
                  {slot.order.map((src, si) => (
                    <div
                      key={src}
                      className="flex items-center gap-1 bg-bg border border-border rounded-lg px-2 py-0.5"
                    >
                      <span className="text-[9px] text-faint">{si + 1}</span>
                      <span className="text-[10px] font-mono text-fg">
                        {src}
                      </span>
                      <button
                        onClick={() =>
                          updateSubSlot(i, {
                            order: slot.order.filter((s) => s !== src),
                          })
                        }
                        className="text-faint hover:text-danger cursor-pointer"
                      >
                        <Trash2 size={9} />
                      </button>
                    </div>
                  ))}
                  {DATA_SOURCES.filter((s) => !slot.order.includes(s)).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() =>
                          updateSubSlot(i, { order: [...slot.order, s] })
                        }
                        className="text-[9px] px-2 py-0.5 border border-dashed border-border rounded-lg text-faint hover:text-fg cursor-pointer"
                      >
                        + {s}
                      </button>
                    ),
                  )}
                </div>
              </Field>
            </div>
          ))}
          <button
            onClick={addSubSlot}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-dashed border-border rounded-xl text-xs text-muted hover:text-fg hover:border-fg/30 transition cursor-pointer w-fit"
          >
            <Plus size={12} /> Add Sub-Slot
          </button>
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
function SettingsToolbar({
  onSave,
  onReset,
  onStatus,
  saving,
  msg,
}: {
  onSave: () => void;
  onReset?: () => void;
  onStatus: () => void;
  saving: boolean;
  msg: { type: "ok" | "err"; text: string } | null;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {msg && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${msg.type === "ok" ? "bg-positive/10 text-positive border-positive/20" : "bg-danger/10 text-danger border-danger/20"}`}
        >
          {msg.type === "ok" ? (
            <CheckCircle2 size={12} />
          ) : (
            <AlertCircle size={12} />
          )}
          {msg.text}
        </div>
      )}
      <div className="flex-1" />
      {/* Status button — left of Reset */}
      <StatusButton onClick={onStatus} />
      {onReset && (
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs text-muted bg-surface hover:text-fg hover:border-fg/20 transition cursor-pointer"
        >
          <RotateCcw size={12} /> Reset to defaults
        </button>
      )}
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-5 py-2 bg-primary text-bg rounded-xl text-xs font-semibold hover:bg-primary-strong transition cursor-pointer disabled:opacity-50"
      >
        <Save size={12} className={saving ? "animate-spin" : ""} />
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

function Section({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 cursor-pointer hover:bg-elevated/40 transition group"
      >
        <div className="flex items-center gap-2">
          <span className="text-muted">{icon}</span>
          <span className="text-sm font-semibold text-fg">{title}</span>
          {hint && (
            <span className="text-[10px] text-faint hidden sm:block">
              {hint}
            </span>
          )}
        </div>
        <span className="text-faint group-hover:text-fg transition">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {open && <div className="px-5 pb-5 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

function Grid({
  children,
  cols = 4,
  className = "",
}: {
  children: React.ReactNode;
  cols?: number;
  className?: string;
}) {
  const cls =
    cols === 1
      ? "grid grid-cols-1"
      : cols === 2
        ? "grid grid-cols-1 sm:grid-cols-2"
        : cols === 3
          ? "grid grid-cols-1 sm:grid-cols-3"
          : "grid grid-cols-2 lg:grid-cols-4";
  return <div className={`${cls} gap-3 ${className}`}>{children}</div>;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-[11px] text-muted font-medium leading-none">
          {label}
        </label>
        {hint && (
          <span title={hint}>
            <Info size={10} className="text-faint cursor-help" />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={inputCls}
      />
    </Field>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </Field>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-elevated border border-border/50 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-fg">{label}</span>
        {hint && (
          <span title={hint}>
            <Info size={10} className="text-faint cursor-help" />
          </span>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-all cursor-pointer relative shrink-0 ${value ? "bg-positive" : "bg-faint/40"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${value ? "left-4" : "left-0.5"}`}
        />
      </button>
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
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer whitespace-nowrap ${active ? "bg-primary text-bg shadow-sm" : "text-muted hover:text-fg hover:bg-elevated"}`}
    >
      {icon} {label}
    </button>
  );
}

function SettingsLoader() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-32 bg-surface border border-border rounded-2xl animate-pulse"
        />
      ))}
    </div>
  );
}

const inputCls =
  "w-full bg-elevated border border-border rounded-xl px-3 py-2 text-xs text-fg placeholder:text-faint outline-none focus:border-primary transition";

const SYSTEM_SOUNDS_LIST = [
  "Basso",
  "Blow",
  "Bottle",
  "Frog",
  "Funk",
  "Glass",
  "Hero",
  "Morse",
  "Ping",
  "Pop",
  "Purr",
  "Sosumi",
  "Submarine",
  "Tink",
];

function MacSoundField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Mac Sound">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        {SYSTEM_SOUNDS_LIST.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </Field>
  );
}

function CustomSoundField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Custom Sound">
      <div className="flex flex-col gap-2">
        <input
          type="file"
          accept=".mp3"
          className="hidden"
          id="sound-file-input"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            onChange(`/sounds/${file.name}`);
          }}
        />
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/sounds/custom.mp3"
            className={`${inputCls} flex-1`}
          />
          <label
            htmlFor="sound-file-input"
            className="shrink-0 px-3 py-2 bg-elevated border border-border rounded-xl text-xs text-muted hover:text-fg cursor-pointer transition"
          >
            Browse
          </label>
        </div>
        {value && (
          <p className="text-[10px] text-faint">
            Make sure this file exists in your project&apos;s sounds/ directory.
          </p>
        )}
      </div>
    </Field>
  );
}

const TEMPLATE_VARS = [
  "{{id}}",
  "{{watchName}}",
  "{{watchId}}",
  "{{conditionType}}",
  "{{url}}",
  "{{message}}",
  "{{firedAt}}",
  "{{value}}",
  "{{prevValue}}",
  "{{change}}",
  "{{direction}}",
];

function TemplateField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [ref, setRef] = useState<HTMLTextAreaElement | null>(null);

  function insertVar(v: string) {
    if (!ref) {
      onChange(value + v);
      return;
    }
    const start = ref.selectionStart ?? value.length;
    const end = ref.selectionEnd ?? value.length;
    const next = value.slice(0, start) + v + value.slice(end);
    onChange(next);
    setTimeout(() => {
      ref.focus();
      ref.selectionStart = start + v.length;
      ref.selectionEnd = start + v.length;
    }, 0);
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label={label} hint={hint}>
        <textarea
          ref={setRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="{{watchName}} fired: {{value}}"
          className={`${inputCls} resize-none font-mono text-[11px]`}
        />
      </Field>
      <div className="flex flex-wrap gap-1">
        {TEMPLATE_VARS.map((v) => (
          <button
            key={v}
            onClick={() => insertVar(v)}
            className="px-2 py-0.5 rounded-full bg-elevated border border-border text-[10px] text-muted hover:text-fg hover:border-primary hover:bg-primary/5 transition cursor-pointer font-mono"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
