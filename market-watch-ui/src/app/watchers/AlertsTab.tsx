"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { apiFetch, apiPost, apiDelete, apiPatch } from "@/lib/api";
import type { Alert } from "@/lib/types";
import { stripHtml } from "./WatchersTab";
import {
  Bell,
  CheckCheck,
  Trash2,
  Search,
  X,
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function conditionText(c: Alert["condition"]): string {
  if (typeof c === "string") return c;
  const t = (c as any).type as string;
  if (t === "above" || t === "below") return `${t} ${(c as any).threshold}`;
  if (t === "between" || t === "outside")
    return `${t} ${(c as any).lo}–${(c as any).hi}`;
  if (t === "change_pct" || t === "change_abs")
    return `change ≥ ${(c as any).threshold}`;
  return t ?? "—";
}

interface AlertsResponse {
  data: Alert[];
  total: number;
}

// ─── Delete Confirm Modal ─────────────────────────────────────
function DeleteModal({
  open,
  message,
  onConfirm,
  onCancel,
  isPending,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
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
            <p className="text-sm font-semibold text-fg">Delete alert?</p>
            <p className="text-xs text-muted leading-relaxed">{message}</p>
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

export default function AlertsTab() {
  const qc = useQueryClient();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const urlRead =
    (searchParams.get("read") as "all" | "unread" | "read") ?? "all";
  const [search, setSearch] = useState(urlSearch);
  const [readFilter, setReadFilter] = useState(urlRead);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function onSearchChange(value: string) {
    setSearch(value);
    updateParams({ search: value || null });
  }

  useEffect(() => {
    setSearch(urlSearch);
    setReadFilter(urlRead);
  }, [urlSearch, urlRead]);

  const { data: alertsData, isLoading } = useQuery<AlertsResponse>({
    queryKey: ["alerts"],
    queryFn: () => apiFetch<AlertsResponse>("watchers/alerts"),
    refetchInterval: 15_000,
  });

  const alerts: Alert[] =
    alertsData?.data ??
    (Array.isArray(alertsData) ? (alertsData as Alert[]) : []);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (search && !a.watchName.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (readFilter === "unread" && a.readAt !== null) return false;
      if (readFilter === "read" && a.readAt === null) return false;
      return true;
    });
  }, [alerts, search, readFilter]);

  const unreadCount = alerts.filter((a) => !a.readAt).length;

  // ── Mutations ────────────────────────────────────────────────
  const markReadMut = useMutation({
    mutationFn: (ids: string[]) => apiPost("watchers/alerts/read", { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const markOneMut = useMutation({
    mutationFn: (id: string) => apiPatch(`watchers/alerts/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`watchers/alerts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      setDeleteTarget(null);
    },
  });

  const deleteAllMut = useMutation({
    mutationFn: () => apiDelete("watchers/alerts"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      setDeleteAllOpen(false);
    },
  });

  function handleClick(alert: Alert) {
    if (!alert.readAt) markOneMut.mutate(alert.id);
    router.push(`/watchers/${alert.watchId}`);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function bulkMarkRead() {
    markReadMut.mutate([...selected]);
    setSelected(new Set());
  }

  function bulkDelete() {
    selected.forEach((id) => deleteMut.mutate(id));
    setSelected(new Set());
    setBulkDeleteOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 w-52">
          <Search size={12} className="text-faint shrink-0" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search alerts…"
            className="bg-transparent text-xs text-fg placeholder:text-faint outline-none flex-1"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="text-faint hover:text-fg cursor-pointer"
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* Read filter */}
        <div className="flex items-center gap-0.5 bg-surface border border-border rounded-xl p-1">
          {(["all", "unread", "read"] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setReadFilter(f);
                updateParams({ read: f === "all" ? null : f });
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium capitalize transition cursor-pointer ${readFilter === f ? "bg-primary text-bg" : "text-muted hover:text-fg"}`}
            >
              {f}
              {f === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Bulk selection info */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl">
            <span className="text-[10px] text-primary font-semibold">
              {selected.size} selected
            </span>
            <button
              onClick={bulkMarkRead}
              className="text-[10px] text-positive hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <CheckCheck size={10} /> Mark read
            </button>
            <button
              onClick={() => setBulkDeleteOpen(true)}
              className="text-[10px] text-danger hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <Trash2 size={10} /> Delete
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-faint hover:text-fg cursor-pointer"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {/* Global actions */}
        <button
          onClick={() =>
            markReadMut.mutate(alerts.filter((a) => !a.readAt).map((a) => a.id))
          }
          disabled={unreadCount === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted bg-surface hover:text-fg hover:border-fg/20 transition cursor-pointer disabled:opacity-40"
        >
          <CheckCheck size={12} /> Mark all read
        </button>
        <button
          onClick={() => setDeleteAllOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-danger/30 text-xs text-danger bg-danger/5 hover:bg-danger/10 transition cursor-pointer"
        >
          <Trash2 size={12} /> Delete all
        </button>
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-surface border border-border rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Bell size={28} className="text-faint" />
          <p className="text-sm text-faint">
            No alerts {readFilter !== "all" ? `(${readFilter})` : ""}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((alert) => {
            const isUnread = !alert.readAt;
            const isSelected = selected.has(alert.id);
            const rawMsg = stripHtml(alert.message ?? "");
            const msg = rawMsg.length > 80 ? rawMsg.slice(0, 80) + "…" : rawMsg;
            const valDisplay =
              typeof alert.currentValue === "string"
                ? stripHtml(alert.currentValue).slice(0, 40)
                : String(alert.currentValue ?? "");

            return (
              <div
                key={alert.id}
                onClick={() => handleClick(alert)}
                className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition group ${
                  isSelected
                    ? "border-primary/50 bg-primary/5"
                    : isUnread
                      ? "border-warning/25 bg-warning/4 hover:border-warning/40"
                      : "border-border/50 bg-surface hover:border-border opacity-60 hover:opacity-100"
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(alert.id);
                  }}
                  className="cursor-pointer shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare size={14} className="text-primary" />
                  ) : (
                    <Square
                      size={14}
                      className="text-faint opacity-0 group-hover:opacity-100 transition"
                    />
                  )}
                </button>

                {/* Unread dot */}
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${isUnread ? "bg-warning" : "bg-transparent"}`}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${isUnread ? "text-fg" : "text-muted"}`}
                    >
                      {alert.watchName}
                    </p>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-md shrink-0 ${
                        alert.engine === "nepse"
                          ? "bg-primary/15 text-primary"
                          : alert.engine === "http"
                            ? "bg-secondary/15 text-secondary"
                            : "bg-warning/15 text-warning"
                      }`}
                    >
                      {alert.engine}
                    </span>
                  </div>
                  {msg && <p className="text-xs text-muted truncate">{msg}</p>}
                </div>

                {/* Value */}
                {valDisplay && (
                  <span className="text-xs font-mono text-fg shrink-0 max-w-24 truncate">
                    {valDisplay}
                  </span>
                )}

                {/* Condition */}
                <span className="text-[10px] text-faint shrink-0 hidden sm:block max-w-32 truncate">
                  {conditionText(alert.condition)}
                </span>

                {/* Time */}
                <span className="text-[10px] text-faint shrink-0 w-16 text-right">
                  {timeAgo(alert.firedAt)}
                </span>

                {/* Delete */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(alert.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition text-faint hover:text-danger cursor-pointer shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Single alert delete modal */}
      <DeleteModal
        open={!!deleteTarget}
        message="This alert will be permanently removed."
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        isPending={deleteMut.isPending}
      />

      {/* Bulk delete modal */}
      <DeleteModal
        open={bulkDeleteOpen}
        message={`${selected.size} alert${selected.size !== 1 ? "s" : ""} will be permanently removed.`}
        onConfirm={bulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {/* Delete all modal */}
      <DeleteModal
        open={deleteAllOpen}
        message="All alerts will be permanently removed. This cannot be undone."
        onConfirm={() => deleteAllMut.mutate()}
        onCancel={() => setDeleteAllOpen(false)}
        isPending={deleteAllMut.isPending}
      />
    </div>
  );
}
