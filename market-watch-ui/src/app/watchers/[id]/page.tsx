"use client";

import { use, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiPatch } from "@/lib/api";
import type { Watch, Alert, HistoryEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  Play,
  RefreshCw,
  Clock,
  Tag,
  ChevronLeft,
  Activity,
  Globe,
  Code2,
  GitBranch,
  ToggleLeft,
  ArrowUpRight,
  Save,
  CheckCircle2,
  Trash2,
  Pause,
  Volume2,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import WatchFormDrawer from "../WatchFormDrawer";

const tt = {
  background: "var(--color-elevated)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  color: "var(--color-fg)",
  fontSize: "11px",
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function stripHtml(html: string): string {
  try {
    const d = new DOMParser().parseFromString(html, "text/html");
    return d.body.textContent?.trim() ?? html;
  } catch {
    return html.replace(/<[^>]+>/g, "").trim();
  }
}

function isNumeric(val: string): boolean {
  return !isNaN(parseFloat(val)) && isFinite(Number(val));
}

function isHtml(val: string): boolean {
  return /<[a-z][\s\S]*>/i.test(val);
}

function ParsedHtml({ html }: { html: string }) {
  const processed = html
    .replace(
      /<img([^>]*?)>/gi,
      (_, attrs) =>
        `<img${attrs} style="width:96px;height:96px;object-fit:cover;border-radius:8px;">`,
    )
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  return (
    <div
      className="text-xs text-fg prose-sm max-w-none [&_img]:rounded-lg [&_a]:text-primary [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: processed }}
    />
  );
}

function getStockRedirect(watch: Watch): string | null {
  const name = watch.name ?? "";
  const ltpMatch = name.match(/\[ltp\]$/i);
  const slTpMatch = name.match(/\[sl\/tp\]$/i);
  if (!ltpMatch && !slTpMatch) return null;
  const parts = name
    .replace(/\[(ltp|sl\/tp)\]$/i, "")
    .trim()
    .split(/\s+/);
  const symbol = parts[0]?.toUpperCase();
  if (!symbol) return null;
  return `/stocks/${symbol}`;
}

// ─── Delete Confirm Modal ─────────────────────────────────────
function DeleteModal({
  open,
  watchName,
  onConfirm,
  onCancel,
  isPending,
}: {
  open: boolean;
  watchName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" />
      <div className="relative bg-surface border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-8 h-8 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={15} className="text-danger" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-fg">Delete watcher?</p>
            <p className="text-xs text-muted leading-relaxed">
              <span className="font-medium text-fg">"{watchName}"</span> will be
              permanently removed. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted hover:text-fg hover:border-fg/20 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-xl bg-danger text-white text-xs font-semibold hover:bg-danger/85 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Trash2 size={11} />
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface HistoryResponse {
  history: HistoryEntry[];
}
interface AlertsResponse {
  alerts: Alert[];
}

export default function WatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [editConditionValues, setEditConditionValues] = useState<
    Record<number, Record<string, string>>
  >({});
  const [savedIdx, setSavedIdx] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  const { data: watch, isLoading: watchLoading } = useQuery<Watch>({
    queryKey: ["watch", id],
    queryFn: () => apiFetch<Watch>(`watchers/watches/${id}`),
    refetchInterval: 10_000,
  });

  const { data: histData } = useQuery<HistoryResponse>({
    queryKey: ["watch-history", id],
    queryFn: () => apiFetch<HistoryResponse>(`watchers/watches/${id}/history`),
    refetchInterval: 30_000,
  });

  const { data: alertData } = useQuery<AlertsResponse>({
    queryKey: ["watch-alerts", id],
    queryFn: () => apiFetch<AlertsResponse>(`watchers/watches/${id}/alerts`),
    refetchInterval: 30_000,
  });

  const runMut = useMutation({
    mutationFn: () => apiPost(`watchers/watches/${id}/run`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watch", id] });
      qc.invalidateQueries({ queryKey: ["watch-history", id] });
    },
  });

  const toggleMut = useMutation({
    mutationFn: () =>
      watch?.enabled
        ? apiPost(`watchers/watches/${id}/disable`)
        : apiPost(`watchers/watches/${id}/enable`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watch", id] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiFetch(`watchers/watches/${id}`, { method: "DELETE" }),
    onSuccess: () => router.push("/watchers"),
  });

  const saveConditionMut = useMutation({
    mutationFn: ({
      condIndex,
      updates,
    }: {
      condIndex: number;
      updates: Record<string, number>;
    }) => {
      if (!watch) throw new Error("No watch");
      const conditions = watch.conditions.map((c, i) =>
        i === condIndex ? { ...c, ...updates } : c,
      );
      return apiPatch(`watchers/watches/${id}`, { conditions });
    },
    onSuccess: (_, { condIndex }) => {
      qc.invalidateQueries({ queryKey: ["watch", id] });
      setSavedIdx(condIndex);
      setTimeout(() => setSavedIdx(null), 2000);
    },
  });

  const rawHistory: HistoryEntry[] =
    histData?.history ??
    (Array.isArray(histData) ? (histData as HistoryEntry[]) : []);
  const recentAlerts: Alert[] =
    alertData?.alerts ??
    (Array.isArray(alertData) ? (alertData as Alert[]) : []);

  const displayHistory = useMemo(() => {
    if (!onlyChanges) return rawHistory;
    return rawHistory.filter(
      (h, i) => i === 0 || h.value !== rawHistory[i - 1].value,
    );
  }, [rawHistory, onlyChanges]);

  const chartData = useMemo(() => {
    return displayHistory
      .filter((h) => isNumeric(h.value))
      .map((h) => ({
        time: timeAgo(h.checkedAt),
        value: parseFloat(h.value),
        fired: h.firedAlert,
      }))
      .reverse();
  }, [displayHistory]);

  const hasNumericChart = chartData.length >= 2;

  if (watchLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!watch) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <p className="text-muted">Watch not found</p>
        <button
          onClick={() => router.back()}
          className="text-primary text-xs cursor-pointer hover:underline"
        >
          ← Back
        </button>
      </div>
    );
  }

  const latestHistory = rawHistory[0];
  const liveValueRaw = latestHistory?.value ?? watch.lastValue ?? null;
  const liveValue = liveValueRaw ? stripHtml(liveValueRaw) : null;
  const liveIsHtml = liveValueRaw ? isHtml(liveValueRaw) : false;

  const stockRedirect = getStockRedirect(watch);

  return (
    <div className="flex flex-col lg:flex-row gap-4 pb-10 max-w-screen-2xl mx-auto w-full page-enter">
      {/* LEFT SIDEBAR */}
      <aside className="lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-fg cursor-pointer w-fit transition"
        >
          <ChevronLeft size={13} /> Back to watchers
        </button>

        {/* Identity card */}
        <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-fg leading-tight">
                {watch.name}
              </h1>
              <p className="text-[10px] text-faint mt-0.5">
                Created {formatDate(watch.createdAt)}
              </p>
            </div>
            <div
              className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${watch.enabled ? "bg-positive animate-pulse" : "bg-faint"}`}
            />
          </div>

          {/* Stock redirect link */}
          {stockRedirect && (
            <button
              onClick={() => router.push(stockRedirect)}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer w-fit"
            >
              <ArrowUpRight size={10} /> View in Stocks
            </button>
          )}

          {/* Engine badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-mono ${watch.engine === "nepse" ? "bg-primary/15 text-primary" : watch.engine === "http" ? "bg-secondary/15 text-secondary" : "bg-warning/15 text-warning"}`}
            >
              {watch.engine === "nepse" ? (
                <Activity size={9} />
              ) : watch.engine === "http" ? (
                <Globe size={9} />
              ) : (
                <Code2 size={9} />
              )}
              {watch.engine}
            </span>
            {watch.scheduleMode && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md ${watch.scheduleMode === "auto" ? "bg-positive/15 text-positive" : watch.scheduleMode === "enabled" ? "bg-primary/15 text-primary" : "bg-faint/20 text-faint"}`}
              >
                {watch.scheduleMode}
              </span>
            )}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md ${watch.enabled ? "text-positive bg-positive/10" : "text-faint bg-elevated"}`}
            >
              {watch.enabled ? "running" : "paused"}
            </span>
          </div>

          {/* Symbol/URL */}
          {"url" in watch && (watch as any).url && (
            <a
              href={(watch as any).url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[10px] text-primary hover:underline truncate"
            >
              <ArrowUpRight size={9} />
              {(watch as any).url}
            </a>
          )}
          {"symbol" in watch && (watch as any).symbol && (
            <p className="text-xs font-mono text-fg">
              {(watch as any).symbol} · {(watch as any).field}
            </p>
          )}

          {(watch.macSound || watch.customSound) && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted">
              <div className="flex items-center gap-1 px-1.5 py-[1px] rounded bg-muted/10 text-muted text-[10px]">
                <Volume2 size={10} />
                <span>{watch.macSound ?? watch.customSound}</span>
              </div>
            </div>
          )}

          {/* Schedule info */}
          {watch.schedule && (
            <div className="flex flex-col gap-2 text-[10px] text-muted">
              <div className="flex items-center gap-1.5">
                <Clock size={10} />
                Every {watch.schedule.defaultIntervalSec}s
                {watch.cooldownSec ? ` · cooldown ${watch.cooldownSec}s` : ""}
              </div>
              {watch.schedule?.windows?.length > 0 && (
                <div className="flex flex-col gap-1.5 pl-4 border-l border-muted/30">
                  {watch.schedule?.windows.map((w, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1"
                    >
                      <span className="px-1.5 py-[1px] rounded bg-muted/10">
                        {w.range}
                      </span>
                      <span>every {w.intervalSec}s</span>
                      {w.days?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {w.days.map((d) => (
                            <span
                              key={d}
                              className="px-1.5 py-[1px] rounded bg-muted/10"
                            >
                              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d] ?? d}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {watch.tags && watch.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag size={10} className="text-faint" />
              {watch.tags.map((t) => (
                <span
                  key={t}
                  className="text-[9px] bg-elevated text-faint px-1.5 py-0.5 rounded-md"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Action panel */}
          <div className="flex gap-2">
            {/* Run Now */}
            <button
              onClick={() => runMut.mutate()}
              disabled={runMut.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-bg rounded-xl text-xs font-semibold hover:bg-primary-strong transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                size={12}
                className={runMut.isPending ? "animate-spin" : ""}
              />
              {runMut.isPending ? "Running…" : "Run Now"}
            </button>

            {/* Edit — opens WatchFormDrawer */}
            <button
              onClick={() => setEditDrawerOpen(true)}
              title="Edit watcher"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border border-border text-muted bg-surface hover:text-fg hover:border-fg/20"
            >
              <Pencil size={12} />
            </button>

            {/* Pause / Resume */}
            <button
              onClick={() => toggleMut.mutate()}
              disabled={toggleMut.isPending}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 border ${watch.enabled ? "border-warning/40 text-warning bg-warning/10 hover:bg-warning/20" : "border-positive/40 text-positive bg-positive/10 hover:bg-positive/20"}`}
            >
              {watch.enabled ? <Pause size={12} /> : <Play size={12} />}
            </button>

            {/* Delete */}
            <button
              onClick={() => setDeleteOpen(true)}
              disabled={deleteMut.isPending}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-danger/30 text-danger bg-danger/8 hover:bg-danger/15 transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Current Value */}
        <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-2">
          <p className="text-[10px] text-faint uppercase tracking-wide">
            Current Value
          </p>
          {liveIsHtml && liveValueRaw ? (
            <div className="max-h-48 overflow-y-auto overflow-x-hidden">
              <ParsedHtml html={liveValueRaw} />
            </div>
          ) : (
            <p
              className={`font-mono text-lg font-bold ${liveValue ? "text-fg" : "text-faint italic"} max-h-48 overflow-y-auto overflow-x-hidden`}
            >
              {liveValue ?? "No data yet"}
            </p>
          )}
          {latestHistory?.checkedAt && (
            <p className="text-[10px] text-faint">
              {timeAgo(latestHistory.checkedAt)}
            </p>
          )}
        </div>

        {/* Conditions with quick threshold edit */}
        <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-[10px] text-faint uppercase tracking-wide">
            Conditions
          </p>
          {watch.conditions?.length > 0 ? (
            watch.conditions.map((cond, i) => (
              <div
                key={i}
                className="bg-elevated rounded-xl p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-primary font-semibold">
                    {cond.type}
                  </span>
                  {(cond as any).message && (
                    <span className="text-[9px] text-faint">
                      {(cond as any).message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {"threshold" in cond &&
                    typeof (cond as any).threshold === "number" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted w-16">
                          threshold
                        </span>
                        <input
                          type="number"
                          value={
                            editConditionValues[i]?.threshold ??
                            String((cond as any).threshold)
                          }
                          onChange={(e) =>
                            setEditConditionValues((prev) => ({
                              ...prev,
                              [i]: { ...prev[i], threshold: e.target.value },
                            }))
                          }
                          className="flex-1 bg-bg border border-border rounded-lg px-2 py-1 text-xs font-mono text-fg outline-none focus:border-primary transition"
                        />
                      </div>
                    )}

                  {"lo" in cond && "hi" in cond && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted w-16">range</span>
                      <input
                        type="number"
                        value={
                          editConditionValues[i]?.lo ?? String((cond as any).lo)
                        }
                        onChange={(e) =>
                          setEditConditionValues((prev) => ({
                            ...prev,
                            [i]: { ...prev[i], lo: e.target.value },
                          }))
                        }
                        className="w-full bg-bg border border-border rounded-lg px-2 py-1 text-xs font-mono text-fg outline-none focus:border-primary transition"
                      />
                      <span className="text-xs text-faint">→</span>
                      <input
                        type="number"
                        value={
                          editConditionValues[i]?.hi ?? String((cond as any).hi)
                        }
                        onChange={(e) =>
                          setEditConditionValues((prev) => ({
                            ...prev,
                            [i]: { ...prev[i], hi: e.target.value },
                          }))
                        }
                        className="w-full bg-bg border border-border rounded-lg px-2 py-1 text-xs font-mono text-fg outline-none focus:border-primary transition"
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        const updates: Record<string, number> = {};
                        const vals = editConditionValues[i];
                        if (vals?.threshold !== undefined)
                          updates.threshold = parseFloat(vals.threshold);
                        if (vals?.lo !== undefined)
                          updates.lo = parseFloat(vals.lo);
                        if (vals?.hi !== undefined)
                          updates.hi = parseFloat(vals.hi);
                        saveConditionMut.mutate({ condIndex: i, updates });
                      }}
                      disabled={saveConditionMut.isPending}
                      className="p-1.5 rounded-lg bg-primary text-bg hover:bg-primary-strong transition cursor-pointer disabled:opacity-40"
                    >
                      {savedIdx === i ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <Save size={12} />
                      )}
                    </button>
                  </div>
                </div>

                {"lo" in cond && (
                  <div className="flex items-center gap-2 text-[10px] text-muted font-mono">
                    <span>{(cond as any).lo}</span>
                    <span>–</span>
                    <span>{(cond as any).hi}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-faint">No conditions configured</p>
          )}
        </div>

        {/* Recent alerts */}
        {recentAlerts.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-[10px] text-faint uppercase tracking-wide">
              Recent Alerts ({recentAlerts.length})
            </p>
            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
              {recentAlerts.slice(0, 10).map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${!a.readAt ? "bg-warning/8 border border-warning/20" : "bg-elevated"}`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="text-xs text-fg truncate">
                      {stripHtml(a.message ?? "").slice(0, 40) || "Alert fired"}
                    </p>
                    {a.currentValue !== null && a.currentValue !== undefined && (
                      <p className="text-[9px] font-mono text-muted truncate">
                        value: {String(a.currentValue)}
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] text-faint shrink-0">
                    {timeAgo(a.firedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* MAIN PANEL */}
      <main className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-fg">Value History</h2>
            <p className="text-[10px] text-faint">
              {displayHistory.length} entries
              {onlyChanges ? " (changes only)" : ""}
            </p>
          </div>
          <button
            onClick={() => setOnlyChanges(!onlyChanges)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition cursor-pointer ${onlyChanges ? "border-primary text-primary bg-primary/10" : "border-border text-muted bg-surface hover:text-fg"}`}
          >
            <ToggleLeft size={13} />
            {onlyChanges ? "Changes only" : "All entries"}
          </button>
        </div>

        {hasNumericChart && (
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-fg">Value over time</p>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip contentStyle={tt} />
                  {chartData
                    .filter((d) => d.fired)
                    .map((d, i) => (
                      <ReferenceLine
                        key={i}
                        x={d.time}
                        stroke="var(--color-warning)"
                        strokeDasharray="3 3"
                      />
                    ))}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={(p) => {
                      const d = chartData[p.index];
                      return d?.fired ? (
                        <circle
                          key={p.index}
                          cx={p.cx}
                          cy={p.cy}
                          r={4}
                          fill="var(--color-warning)"
                        />
                      ) : (
                        <circle
                          key={p.index}
                          cx={p.cx}
                          cy={p.cy}
                          r={2}
                          fill="var(--color-primary)"
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[9px] text-faint">⚡ Yellow lines = alert fired</p>
          </div>
        )}

        {displayHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 bg-surface border border-border rounded-2xl">
            <GitBranch size={28} className="text-faint" />
            <p className="text-sm text-faint">No history yet</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto">
              {displayHistory.map((entry, i) => {
                const isHtmlVal = isHtml(entry.value);
                const textVal = isHtmlVal ? stripHtml(entry.value) : entry.value;
                return (
                  <div
                    key={i}
                    className={`flex gap-4 px-4 py-3 border-b border-border/40 last:border-0 transition-colors ${entry.firedAlert ? "bg-warning/6 border-l-2 border-l-warning" : "hover:bg-elevated/40"}`}
                  >
                    <div className="shrink-0 w-24 flex flex-col gap-0.5 pt-0.5">
                      <span className="text-[10px] text-muted">
                        {timeAgo(entry.checkedAt)}
                      </span>
                      {entry.elapsedMs && (
                        <span className="text-[9px] text-faint">
                          {entry.elapsedMs}ms
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isHtmlVal ? (
                        <div className="max-h-24 overflow-hidden">
                          <ParsedHtml html={entry.value} />
                        </div>
                      ) : (
                        <p className="text-xs font-mono text-fg break-all leading-relaxed">
                          {entry.value}
                        </p>
                      )}
                    </div>
                    {entry.firedAlert && (
                      <span className="shrink-0 text-[9px] bg-warning/20 text-warning px-2 py-0.5 rounded-full h-fit mt-0.5">
                        ⚡ fired
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Delete confirm modal */}
      <DeleteModal
        open={deleteOpen}
        watchName={watch.name}
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setDeleteOpen(false)}
        isPending={deleteMut.isPending}
      />

      {/* Edit drawer */}
      <WatchFormDrawer
        open={editDrawerOpen}
        watch={watch}
        onClose={() => setEditDrawerOpen(false)}
      />
    </div>
  );
}
