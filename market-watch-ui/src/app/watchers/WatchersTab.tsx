"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { apiFetch, apiPost, apiDelete, apiPatch } from "@/lib/api";
import type { Watch, ScheduleMode } from "@/lib/types";
import WatchFormDrawer from "./WatchFormDrawer";
import {
  Play,
  Pause,
  Trash2,
  RefreshCw,
  LayoutGrid,
  List,
  Tag,
  Clock,
  Search,
  X,
  CheckSquare,
  Square,
  ChevronDown,
  Zap,
  Globe,
  Code2,
  Activity,
  Radio,
  AlertTriangle,
} from "lucide-react";

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

function intervalLabel(sec?: number): string {
  if (!sec) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${sec / 60}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

function stripHtml(html: string): string {
  try {
    const d = new DOMParser().parseFromString(html, "text/html");
    return d.body.textContent?.trim() ?? html;
  } catch {
    return html.replace(/<[^>]+>/g, "").trim();
  }
}

function conditionSummary(w: Watch): string {
  return w.conditions
    .map((c) => {
      const t = c.type;
      if (t === "above" || t === "below") return `${t} ${c.threshold}`;
      if (t === "between") return `${c.lo}–${c.hi}`;
      if (t === "change_pct") return `change ≥ ${c.threshold}%`;
      return t;
    })
    .join(" & ");
}

const ENGINE_ICON: Record<string, React.ReactNode> = {
  nepse: <Activity size={11} />,
  http: <Globe size={11} />,
  puppeteer: <Code2 size={11} />,
};

type ViewMode = "grid" | "list";

// ─── Delete Confirm Modal ─────────────────────────────────────
function DeleteModal({
  open,
  title,
  onConfirm,
  onCancel,
  isPending,
}: {
  open: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        ref={ref}
        className="relative bg-surface border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl flex flex-col gap-4"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-8 h-8 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={15} className="text-danger" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-fg">Delete watcher?</p>
            <p className="text-xs text-muted leading-relaxed">
              <span className="font-medium text-fg">"{title}"</span> will be
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

// ─── Bulk Delete Modal ────────────────────────────────────────
function BulkDeleteModal({
  open,
  count,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

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
            <p className="text-sm font-semibold text-fg">
              Delete {count} watcher{count !== 1 ? "s" : ""}?
            </p>
            <p className="text-xs text-muted leading-relaxed">
              All selected watchers will be permanently removed.
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
            className="px-4 py-2 rounded-xl bg-danger text-white text-xs font-semibold hover:bg-danger/85 transition cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={11} /> Delete {count}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WatchersTab({
  onNewWatch,
}: {
  onNewWatch: () => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isMdUp, setIsMdUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMdUp(e.matches);
    };
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function setParam(key: string, value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!isMdUp && key === "view") return;
    if (!value || value === "all" || value === "grid") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, {
      scroll: false,
    });
  }

  const urlView = (searchParams.get("view") as ViewMode) || "grid";
  const view: ViewMode = isMdUp ? urlView : "grid";

  const search = searchParams.get("search") || "";
  const tagFilter = searchParams.get("tag") || "all";
  const statusFilter =
    (searchParams.get("status") as "all" | "enabled" | "disabled") || "all";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editWatch, setEditWatch] = useState<Watch | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Watch | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: watches = [], isLoading } = useQuery<Watch[]>({
    queryKey: ["watches"],
    queryFn: () => apiFetch<Watch[]>("watchers/watches"),
    refetchInterval: 30_000,
  });

  const allTags = useMemo(() => {
    const set = new Set<string>();
    watches.forEach((w) => w.tags?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [watches]);

  const filtered = useMemo(() => {
    return watches.filter((w) => {
      if (search && !w.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (tagFilter !== "all" && !w.tags?.includes(tagFilter)) return false;
      if (statusFilter === "enabled" && !w.enabled) return false;
      if (statusFilter === "disabled" && w.enabled) return false;
      return true;
    });
  }, [watches, search, tagFilter, statusFilter]);

  // ── Mutations ────────────────────────────────────────────────
  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiFetch(`watchers/watches/${id}/${enabled ? "enable" : "disable"}`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watches"] }),
  });

  const modeMut = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: ScheduleMode }) =>
      apiPost(`watchers/watches/${id}/mode`, { mode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watches"] }),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => apiPost(`watchers/watches/${id}/run`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watches"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`watchers/watches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watches"] });
      setDeleteTarget(null);
    },
  });

  // ── Bulk actions ─────────────────────────────────────────────
  function bulkEnable() {
    selected.forEach((id) => toggleMut.mutate({ id, enabled: true }));
  }
  function bulkDisable() {
    selected.forEach((id) => toggleMut.mutate({ id, enabled: false }));
  }
  function bulkDelete() {
    selected.forEach((id) => deleteMut.mutate(id));
    setSelected(new Set());
    setBulkDeleteOpen(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((w) => w.id)));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 w-52">
          <Search size={12} className="text-faint shrink-0" />
          <input
            value={search}
            onChange={(e) => setParam("search", e.target.value)}
            placeholder="Search watchers…"
            className="bg-transparent text-xs text-fg placeholder:text-faint outline-none flex-1"
          />
          {search && (
            <button
              onClick={() => setParam("search", "")}
              className="text-faint hover:text-fg cursor-pointer"
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-0.5 bg-surface border border-border rounded-xl p-1">
          {(["all", "enabled", "disabled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setParam("status", s)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium capitalize transition cursor-pointer ${statusFilter === s ? "bg-primary text-bg" : "text-muted hover:text-fg"}`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1">
            <Tag size={11} className="text-faint" />
            <select
              value={tagFilter}
              onChange={(e) => setParam("tag", e.target.value)}
              className="bg-surface border border-border rounded-xl px-2 py-1.5 text-xs text-fg outline-none cursor-pointer"
            >
              <option value="all">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1" />

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl">
            <span className="text-[10px] text-primary font-semibold">
              {selected.size} selected
            </span>
            <button
              onClick={bulkEnable}
              className="text-[10px] text-positive hover:underline cursor-pointer"
            >
              Enable
            </button>
            <button
              onClick={bulkDisable}
              className="text-[10px] text-warning hover:underline cursor-pointer"
            >
              Disable
            </button>
            <button
              onClick={() => setBulkDeleteOpen(true)}
              className="text-[10px] text-danger hover:underline cursor-pointer"
            >
              Delete
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-faint hover:text-fg cursor-pointer"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {/* Select all */}
        <button
          onClick={
            selected.size === filtered.length
              ? () => setSelected(new Set())
              : selectAll
          }
          className="flex items-center gap-1 text-[10px] text-muted hover:text-fg cursor-pointer transition"
        >
          {selected.size === filtered.length && filtered.length > 0 ? (
            <CheckSquare size={13} className="text-primary" />
          ) : (
            <Square size={13} />
          )}
          All
        </button>

        {/* View toggle */}
        <div className="hidden md:flex items-center gap-0.5 bg-surface border border-border rounded-xl p-1">
          <button
            onClick={() => setParam("view", "grid")}
            className={`p-1.5 rounded-lg transition cursor-pointer ${view === "grid" ? "bg-primary text-bg" : "text-muted hover:text-fg"}`}
          >
            <LayoutGrid size={12} />
          </button>
          <button
            onClick={() => setParam("view", "list")}
            className={`p-1.5 rounded-lg transition cursor-pointer ${view === "list" ? "bg-primary text-bg" : "text-muted hover:text-fg"}`}
          >
            <List size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div
          className={
            view === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
              : "flex flex-col gap-2"
          }
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`bg-surface border border-border rounded-2xl animate-pulse ${view === "grid" ? "h-48" : "h-16"}`}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Radio size={28} className="text-faint" />
          <p className="text-sm text-faint">No watchers found</p>
          <button
            onClick={onNewWatch}
            className="text-xs text-primary cursor-pointer hover:underline"
          >
            + New Watch
          </button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((w) => (
            <WatchCard
              key={w.id}
              watch={w}
              selected={selected.has(w.id)}
              onSelect={() => toggleSelect(w.id)}
              onEdit={() => setEditWatch(w)}
              onRun={() => runMut.mutate(w.id)}
              onToggle={() =>
                toggleMut.mutate({ id: w.id, enabled: !w.enabled })
              }
              onMode={(m) => modeMut.mutate({ id: w.id, mode: m })}
              onDelete={() => setDeleteTarget(w)}
              onClick={() => router.push(`/watchers/${w.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((w) => (
            <WatchRow
              key={w.id}
              watch={w}
              selected={selected.has(w.id)}
              onSelect={() => toggleSelect(w.id)}
              onEdit={() => setEditWatch(w)}
              onRun={() => runMut.mutate(w.id)}
              onToggle={() =>
                toggleMut.mutate({ id: w.id, enabled: !w.enabled })
              }
              onMode={(m) => modeMut.mutate({ id: w.id, mode: m })}
              onDelete={() => setDeleteTarget(w)}
              onClick={() => router.push(`/watchers/${w.id}`)}
            />
          ))}
        </div>
      )}

      {editWatch && (
        <WatchFormDrawer
          open={!!editWatch}
          watch={editWatch}
          onClose={() => setEditWatch(null)}
        />
      )}

      {/* Single delete modal */}
      <DeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.name ?? ""}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        isPending={deleteMut.isPending}
      />

      {/* Bulk delete modal */}
      <BulkDeleteModal
        open={bulkDeleteOpen}
        count={selected.size}
        onConfirm={bulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  WATCH CARD (grid)
// ─────────────────────────────────────────────────────────────
function WatchCard({
  watch: w,
  selected,
  onSelect,
  onEdit,
  onRun,
  onToggle,
  onMode,
  onDelete,
  onClick,
}: {
  watch: Watch;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRun: () => void;
  onToggle: () => void;
  onMode: (m: ScheduleMode) => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const [modeOpen, setModeOpen] = useState(false);
  const rawValue = w.lastValue ? stripHtml(w.lastValue) : null;
  const displayValue =
    rawValue && rawValue.length > 40 ? rawValue.slice(0, 40) + "…" : rawValue;

  return (
    <div
      onClick={onClick}
      className={`relative bg-surface border rounded-2xl p-4 flex flex-col gap-3 cursor-pointer hover:border-primary/40 hover:shadow-lg transition-all group overflow-hidden ${selected ? "border-primary ring-1 ring-primary/30" : "border-border"} ${!w.enabled ? "opacity-60" : ""}`}
    >
      {/* Select checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        {selected ? (
          <CheckSquare size={14} className="text-primary" />
        ) : (
          <Square size={14} className="text-faint" />
        )}
      </button>

      {/* Status dot */}
      <div
        className={`absolute top-3 right-3 w-2 h-2 rounded-full ${w.enabled ? "bg-positive animate-pulse" : "bg-faint"}`}
      />

      {/* Header */}
      <div className="pt-1">
        <p className="text-sm font-semibold text-fg pr-6 leading-tight line-clamp-2">
          {w.name}
        </p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span
            className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-mono ${
              w.engine === "nepse"
                ? "bg-primary/15 text-primary"
                : w.engine === "http"
                  ? "bg-secondary/15 text-secondary"
                  : "bg-warning/15 text-warning"
            }`}
          >
            {ENGINE_ICON[w.engine]} {w.engine}
          </span>
          {w.scheduleMode && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                w.scheduleMode === "auto"
                  ? "bg-positive/15 text-positive"
                  : w.scheduleMode === "enabled"
                    ? "bg-primary/15 text-primary"
                    : "bg-faint/30 text-faint"
              }`}
            >
              {w.scheduleMode}
            </span>
          )}
          {w.tags?.map((t) => (
            <span
              key={t}
              className="text-[9px] bg-elevated text-faint px-1.5 py-0.5 rounded-md"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Current value */}
      <div className="bg-elevated rounded-xl px-3 py-2 min-h-[2.5rem] flex items-center">
        <p
          className={`text-xs font-mono ${displayValue ? "text-fg" : "text-faint italic"}`}
        >
          {displayValue ?? "No data yet"}
        </p>
      </div>

      {/* Conditions */}
      <p className="text-[10px] text-muted truncate">
        {conditionSummary(w) || "No conditions"}
      </p>

      {/* Meta */}
      <div className="flex items-center justify-between text-[9px] text-faint">
        <span className="flex items-center gap-1">
          <Clock size={9} />
          {timeAgo(w.lastCheckedAt)}
        </span>
        <span>{intervalLabel(w.schedule?.defaultIntervalSec)}</span>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-1.5 pt-1 border-t border-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        <ActionBtn onClick={onRun} title="Run now" color="text-primary">
          <RefreshCw size={11} />
        </ActionBtn>
        <ActionBtn
          onClick={onToggle}
          title={w.enabled ? "Pause" : "Resume"}
          color={w.enabled ? "text-warning" : "text-positive"}
        >
          {w.enabled ? <Pause size={11} /> : <Play size={11} />}
        </ActionBtn>
        <ActionBtn onClick={onEdit} title="Edit" color="text-muted">
          <Zap size={11} />
        </ActionBtn>

        {/* Mode dropdown */}
        <div className="relative ml-auto">
          <button
            onClick={() => setModeOpen(!modeOpen)}
            className="flex items-center gap-0.5 text-[9px] text-faint bg-elevated px-2 py-1 rounded-lg hover:text-fg cursor-pointer transition border border-border/50"
          >
            {w.scheduleMode ?? "auto"} <ChevronDown size={9} />
          </button>
          {modeOpen && (
            <div className="absolute bottom-full mb-1 right-0 bg-elevated border border-border rounded-xl p-1 flex flex-col gap-0.5 z-20 shadow-xl min-w-24">
              {(["auto", "enabled", "disabled"] as ScheduleMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    onMode(m);
                    setModeOpen(false);
                  }}
                  className={`text-[10px] px-3 py-1.5 rounded-lg text-left capitalize cursor-pointer transition ${w.scheduleMode === m ? "bg-primary/15 text-primary" : "text-muted hover:bg-elevated hover:text-fg"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <ActionBtn onClick={onDelete} title="Delete" color="text-danger">
          <Trash2 size={11} />
        </ActionBtn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  WATCH ROW (list)
// ─────────────────────────────────────────────────────────────
function WatchRow({
  watch: w,
  selected,
  onSelect,
  onEdit,
  onRun,
  onToggle,
  onMode,
  onDelete,
  onClick,
}: {
  watch: Watch;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRun: () => void;
  onToggle: () => void;
  onMode: (m: ScheduleMode) => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const [modeOpen, setModeOpen] = useState(false);
  const rawValue = w.lastValue ? stripHtml(w.lastValue) : null;
  const display =
    rawValue && rawValue.length > 30 ? rawValue.slice(0, 30) + "…" : rawValue;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 bg-surface border rounded-xl px-4 py-3 cursor-pointer hover:border-primary/30 transition group justify-between ${selected ? "border-primary/50 bg-primary/5" : "border-border"} ${!w.enabled ? "opacity-60" : ""}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className="cursor-pointer shrink-0"
      >
        {selected ? (
          <CheckSquare size={14} className="text-primary" />
        ) : (
          <Square
            size={14}
            className="text-faint opacity-0 group-hover:opacity-100 transition"
          />
        )}
      </button>

      <div
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${w.enabled ? "bg-positive" : "bg-faint"}`}
      />

      <p className="text-sm font-semibold text-fg min-w-0 truncate">{w.name}</p>

      <span
        className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${
          w.engine === "nepse"
            ? "bg-primary/15 text-primary"
            : w.engine === "http"
              ? "bg-secondary/15 text-secondary"
              : "bg-warning/15 text-warning"
        }`}
      >
        {w.engine}
      </span>

      <p className="text-xs font-mono text-muted w-full flex-1 shrink-0">
        {display ?? "—"}
      </p>
      <p className="text-[10px] text-faint shrink-0 w-20 text-right">
        {timeAgo(w.lastCheckedAt)}
      </p>
      <p className="text-[10px] text-faint shrink-0">
        {intervalLabel(w.schedule?.defaultIntervalSec)}
      </p>

      <div
        className="flex items-center gap-1.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <ActionBtn onClick={onRun} title="Run" color="text-primary">
          <RefreshCw size={11} />
        </ActionBtn>
        <ActionBtn
          onClick={onToggle}
          title={w.enabled ? "Pause" : "Resume"}
          color={w.enabled ? "text-warning" : "text-positive"}
        >
          {w.enabled ? <Pause size={11} /> : <Play size={11} />}
        </ActionBtn>

        <div className="relative">
          <button
            onClick={() => setModeOpen(!modeOpen)}
            className="text-[9px] text-faint bg-elevated px-2 py-1 rounded-lg flex items-center gap-0.5 cursor-pointer border border-border/50 hover:text-fg transition"
          >
            {w.scheduleMode ?? "auto"}
            <ChevronDown size={9} />
          </button>
          {modeOpen && (
            <div className="absolute bottom-full mb-1 right-0 bg-elevated border border-border rounded-xl p-1 flex flex-col gap-0.5 z-20 shadow-xl min-w-24">
              {(["auto", "enabled", "disabled"] as ScheduleMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    onMode(m);
                    setModeOpen(false);
                  }}
                  className={`text-[10px] px-3 py-1.5 rounded-lg text-left capitalize cursor-pointer ${w.scheduleMode === m ? "bg-primary/15 text-primary" : "text-muted hover:bg-elevated hover:text-fg"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <ActionBtn onClick={onEdit} title="Edit" color="text-muted">
          <Zap size={11} />
        </ActionBtn>
        <ActionBtn onClick={onDelete} title="Delete" color="text-danger">
          <Trash2 size={11} />
        </ActionBtn>
      </div>
    </div>
  );
}

function ActionBtn({
  onClick,
  title,
  color,
  children,
}: {
  onClick: () => void;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded-lg hover:bg-elevated transition cursor-pointer ${color}`}
    >
      {children}
    </button>
  );
}

// Re-export for other files
export { timeAgo, stripHtml, conditionSummary };
