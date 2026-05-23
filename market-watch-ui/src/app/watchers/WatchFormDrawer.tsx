"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiFetch, apiPost } from "@/lib/api";
import type {
  Watch,
  WatchEngine,
  ScheduleMode,
  Condition,
  DaysNumber,
} from "@/lib/types";
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Volume2,
} from "lucide-react";

const CONDITION_TYPES = [
  "above",
  "below",
  "above_equal",
  "below_equal",
  "between",
  "outside",
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "any_change",
  "increases",
  "decreases",
  "change_pct",
  "change_abs",
  "count_above",
  "count_below",
] as const;

const NEPSE_FIELDS = [
  "ltp",
  "percentChange",
  "volume",
  "high",
  "low",
  "open",
] as const;
const SCHEDULE_MODES: ScheduleMode[] = ["auto", "enabled", "disabled"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SYSTEM_SOUNDS = [
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

function emptyCondition(): Condition {
  return { type: "above", threshold: 0 } as Condition;
}

interface ScheduleWindowForm {
  range: string; // "HH:MM-HH:MM"
  intervalSec: string;
  days: [DaysNumber, DaysNumber];
}

interface FormState {
  name: string;
  engine: WatchEngine;
  enabled: boolean;
  scheduleMode: ScheduleMode;
  symbol: string;
  field: string;
  url: string;
  selector: string;
  index: string;
  attribute: string;
  defaultIntervalSec: string;
  cooldownSec: string;
  tags: string;
  conditions: Condition[];
  // Sound
  soundType: "system" | "custom" | "none";
  systemSound: string;
  customSoundId: string;
  // Schedule windows
  scheduleWindows: ScheduleWindowForm[];
}

function defaultForm(watch?: Watch): FormState {
  const w = watch as any;
  return {
    name: w?.name ?? "",
    engine: w?.engine ?? "nepse",
    enabled: w?.enabled ?? true,
    scheduleMode: w?.scheduleMode ?? "auto",
    symbol: w?.symbol ?? "",
    field: w?.field ?? "ltp",
    url: w?.url ?? "",
    selector: w?.selector ?? "",
    index: String(w?.index ?? ""),
    attribute: w?.attribute ?? "",
    defaultIntervalSec: String(w?.schedule?.defaultIntervalSec ?? 60),
    cooldownSec: String(w?.cooldownSec ?? ""),
    tags: (w?.tags ?? []).join(", "),
    conditions: w?.conditions?.length ? w.conditions : [emptyCondition()],
    soundType: w?.customSound ? "custom" : w?.macSound ? "system" : "system",
    systemSound: w?.macSound ?? "Glass",
    customSoundId: w?.customSound ?? "",
    scheduleWindows: (w?.schedule?.windows ?? []).map((sw: any) => ({
      range: sw.range ?? "09:00-15:00",
      intervalSec: String(sw.intervalSec ?? 60),
      days: sw.days ?? [0, 1, 2, 3, 4],
    })),
  };
}

function buildPayload(f: FormState) {
  const windows = f.scheduleWindows
    .filter((w) => w.range)
    .map((w) => ({
      range: w.range as `${string}-${string}`,
      intervalSec: parseInt(w.intervalSec) || 60,
      days: w.days.slice().sort() as number[],
    }));

  const base: Record<string, unknown> = {
    name: f.name.trim(),
    engine: f.engine,
    enabled: f.enabled,
    scheduleMode: f.scheduleMode,
    schedule: {
      defaultIntervalSec: parseInt(f.defaultIntervalSec) || 60,
      ...(windows.length > 0 ? { windows } : {}),
    },
    cooldownSec: f.cooldownSec ? parseInt(f.cooldownSec) : undefined,
    tags: f.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    conditions: f.conditions,
    // Sound
    macSound: f.soundType === "system" ? f.systemSound : null,
    customSound: f.soundType === "custom" ? f.customSoundId : null,
  };

  if (f.engine === "nepse") {
    return { ...base, symbol: f.symbol.toUpperCase(), field: f.field };
  }
  return {
    ...base,
    url: f.url,
    selector: f.selector,
    index: f.index !== "" ? parseInt(f.index) : undefined,
    attribute: f.attribute || undefined,
  };
}

export default function WatchFormDrawer({
  open,
  onClose,
  watch,
}: {
  open: boolean;
  onClose: () => void;
  watch?: Watch;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(defaultForm(watch));
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  // Fetch custom sounds from settings
  const { data: watcherSettings } = useQuery({
    queryKey: ["watcher-settings"],
    queryFn: () => apiFetch<{ customSound?: string }>("watchers/settings"),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setForm(defaultForm(watch));
      setMsg(null);
    }
  }, [open, watch]);

  const isEdit = !!watch;

  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      isEdit
        ? apiFetch(`watchers/watches/${watch!.id}`, { method: "PATCH", body })
        : apiPost("watchers/watches", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watches"] });
      setMsg({ type: "ok", text: isEdit ? "Watch updated" : "Watch created" });
      setTimeout(() => onClose(), 1200);
    },
    onError: (e) => setMsg({ type: "err", text: e.message }),
  });

  function field<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function setCondition(i: number, cond: Condition) {
    setForm((f) => {
      const next = [...f.conditions];
      next[i] = cond;
      return { ...f, conditions: next };
    });
  }

  function addWindow() {
    setForm((f) => ({
      ...f,
      scheduleWindows: [
        ...f.scheduleWindows,
        { range: "09:00-15:00", intervalSec: "60", days: [0, 4] },
      ],
    }));
  }

  function removeWindow(i: number) {
    setForm((f) => ({
      ...f,
      scheduleWindows: f.scheduleWindows.filter((_, ci) => ci !== i),
    }));
  }

  function updateWindow(i: number, key: keyof ScheduleWindowForm, val: any) {
    setForm((f) => {
      const next = [...f.scheduleWindows];
      next[i] = { ...next[i], [key]: val };
      return { ...f, scheduleWindows: next };
    });
  }

  function submit() {
    if (!form.name) {
      setMsg({ type: "err", text: "Name is required" });
      return;
    }
    if (form.engine === "nepse" && !form.symbol) {
      setMsg({ type: "err", text: "Symbol is required for NEPSE engine" });
      return;
    }
    if (
      (form.engine === "http" || form.engine === "puppeteer") &&
      (!form.url || !form.selector)
    ) {
      setMsg({ type: "err", text: "URL and selector are required" });
      return;
    }
    saveMut.mutate(buildPayload(form) as any);
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-bg/60 backdrop-blur-sm z-40"
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-surface border-l border-border z-50 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-fg">
              {isEdit ? "Edit Watch" : "New Watch"}
            </h2>
            <p className="text-[10px] text-faint mt-0.5">
              {isEdit
                ? "Update watcher configuration"
                : "Create a new condition watcher"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-elevated transition cursor-pointer text-muted hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Name */}
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder="e.g. NABIL above 550"
              className={inputCls}
            />
          </Field>

          {/* Engine */}
          <Field label="Engine">
            <div className="grid grid-cols-3 gap-2">
              {(["nepse", "http", "puppeteer"] as WatchEngine[]).map((e) => (
                <button
                  key={e}
                  onClick={() => field("engine", e)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border capitalize transition cursor-pointer ${form.engine === e ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:border-fg/20 hover:text-fg"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          {/* Engine-specific */}
          {form.engine === "nepse" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Symbol">
                <input
                  value={form.symbol}
                  onChange={(e) =>
                    field("symbol", e.target.value.toUpperCase())
                  }
                  placeholder="NABIL"
                  className={inputCls}
                />
              </Field>
              <Field label="Field">
                <select
                  value={form.field}
                  onChange={(e) => field("field", e.target.value)}
                  className={inputCls}
                >
                  {NEPSE_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Field label="URL">
                <input
                  value={form.url}
                  onChange={(e) => field("url", e.target.value)}
                  placeholder="https://example.com"
                  className={inputCls}
                />
              </Field>
              <Field label="CSS Selector">
                <input
                  value={form.selector}
                  onChange={(e) => field("selector", e.target.value)}
                  placeholder=".price-value"
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Index (optional)">
                  <input
                    type="number"
                    value={form.index}
                    onChange={(e) => field("index", e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
                <Field label="Attribute (optional)">
                  <input
                    value={form.attribute}
                    onChange={(e) => field("attribute", e.target.value)}
                    placeholder="href"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* Conditions */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted font-medium">
                Conditions
              </label>
              <button
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    conditions: [...f.conditions, emptyCondition()],
                  }))
                }
                className="flex items-center gap-1 text-[10px] text-primary cursor-pointer hover:underline"
              >
                <Plus size={10} /> Add
              </button>
            </div>
            {form.conditions.map((cond, i) => (
              <ConditionEditor
                key={i}
                cond={cond}
                onChange={(c) => setCondition(i, c)}
                onRemove={() =>
                  setForm((f) => ({
                    ...f,
                    conditions: f.conditions.filter((_, ci) => ci !== i),
                  }))
                }
                canRemove={form.conditions.length > 1}
              />
            ))}
          </div>

          {/* Schedule */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted font-medium flex items-center gap-1">
                <Clock size={11} /> Schedule
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default Interval (sec)">
                <input
                  type="number"
                  value={form.defaultIntervalSec}
                  onChange={(e) => field("defaultIntervalSec", e.target.value)}
                  placeholder="60"
                  className={inputCls}
                />
              </Field>
              <Field label="Cooldown (sec)">
                <input
                  type="number"
                  value={form.cooldownSec}
                  onChange={(e) => field("cooldownSec", e.target.value)}
                  placeholder="300"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Schedule windows */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-faint">
                  Time Windows (optional)
                </span>
                <button
                  onClick={addWindow}
                  className="text-[10px] text-primary cursor-pointer hover:underline flex items-center gap-0.5"
                >
                  <Plus size={10} /> Add Window
                </button>
              </div>
              {form.scheduleWindows.map((win, i) => (
                <div
                  key={i}
                  className="bg-elevated border border-border/50 rounded-xl p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={win.range?.split("-")[0] || ""}
                        onChange={(e) => {
                          const start = e.target.value;

                          const end = win.range?.split("-")[1] || "15:00";

                          updateWindow(i, "range", `${start}-${end}`);
                        }}
                        className="flex-1 bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-fg font-mono outline-none focus:border-primary"
                      />

                      <span className="text-faint text-xs">→</span>

                      <input
                        type="time"
                        value={win.range?.split("-")[1] || ""}
                        onChange={(e) => {
                          const end = e.target.value;

                          const start = win.range?.split("-")[0] || "09:00";

                          updateWindow(i, "range", `${start}-${end}`);
                        }}
                        className="flex-1 bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-fg font-mono outline-none focus:border-primary"
                      />
                    </div>
                    <input
                      type="number"
                      value={win.intervalSec}
                      onChange={(e) =>
                        updateWindow(i, "intervalSec", e.target.value)
                      }
                      placeholder="60"
                      className="w-20 bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-fg font-mono outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => removeWindow(i)}
                      className="text-faint hover:text-danger cursor-pointer transition p-1"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {DAY_LABELS.map((label, di) => {
                      const active = win.days.includes(di);
                      return (
                        <button
                          key={di}
                          onClick={() => {
                            const next = active
                              ? win.days.filter((d) => d !== di)
                              : [...win.days, di].sort((a, b) => a - b);
                            updateWindow(i, "days", next);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${active ? "bg-primary/15 border-primary/30 text-primary" : "border-border text-faint hover:text-fg hover:border-fg/20"}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-faint">
                    Days:{" "}
                    {win.days.map((d) => DAY_LABELS[d]).join(", ") || "none"} ·
                    interval {win.intervalSec}s · range {win.range}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule mode */}
          <Field label="Schedule Mode">
            <div className="flex gap-2">
              {SCHEDULE_MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => field("scheduleMode", m)}
                  className={`flex-1 py-2 rounded-xl border text-xs capitalize transition cursor-pointer ${form.scheduleMode === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:border-fg/20 hover:text-fg"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>

          {/* Sound */}
          <div className="flex flex-col gap-3">
            <label className="text-[11px] text-muted font-medium flex items-center gap-1">
              <Volume2 size={11} /> Alert Sound
            </label>
            <div className="flex gap-2">
              {(["system", "custom", "none"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => field("soundType", t)}
                  className={`flex-1 py-2 rounded-xl border text-xs capitalize transition cursor-pointer ${form.soundType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:border-fg/20 hover:text-fg"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {form.soundType === "system" && (
              <select
                value={form.systemSound}
                onChange={(e) => field("systemSound", e.target.value)}
                className={inputCls}
              >
                {SYSTEM_SOUNDS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            {form.soundType === "custom" && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] text-faint">
                  Custom sounds are managed in Settings → Watchers → Sound
                </p>
                <input
                  value={form.customSoundId}
                  onChange={(e) => field("customSoundId", e.target.value)}
                  placeholder="Path to custom sound file"
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Tags */}
          <Field label="Tags (comma-separated)">
            <input
              value={form.tags}
              onChange={(e) => field("tags", e.target.value)}
              placeholder="bank, alert, nepse"
              className={inputCls}
            />
          </Field>

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-muted font-medium">
              Enabled
            </label>
            <button
              onClick={() => field("enabled", !form.enabled)}
              className={`w-10 h-5 rounded-full transition-all cursor-pointer relative ${form.enabled ? "bg-positive" : "bg-faint"}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.enabled ? "left-5" : "left-0.5"}`}
              />
            </button>
          </div>

          {/* Message */}
          {msg && (
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs border ${msg.type === "ok" ? "bg-positive/10 text-positive border-positive/20" : "bg-danger/10 text-danger border-danger/20"}`}
            >
              {msg.type === "ok" ? (
                <CheckCircle2 size={13} />
              ) : (
                <AlertCircle size={13} />
              )}
              {msg.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-fg hover:border-fg/30 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saveMut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-primary text-bg text-sm font-semibold hover:bg-primary-strong transition cursor-pointer disabled:opacity-50"
          >
            {saveMut.isPending
              ? "Saving…"
              : isEdit
                ? "Save Changes"
                : "Create Watch"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Condition editor ──────────────────────────────────────────
function ConditionEditor({
  cond,
  onChange,
  onRemove,
  canRemove,
}: {
  cond: Condition;
  onChange: (c: Condition) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const c = cond as any;
  const needsThreshold = [
    "above",
    "below",
    "above_equal",
    "below_equal",
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "count_above",
    "count_below",
  ].includes(cond.type);
  const needsRange = ["between", "outside"].includes(cond.type);
  const needsPct = ["change_pct", "change_abs"].includes(cond.type);

  return (
    <div className="bg-elevated border border-border/60 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          value={cond.type}
          onChange={(e) =>
            onChange({ ...cond, type: e.target.value } as Condition)
          }
          className="flex-1 bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-fg outline-none cursor-pointer focus:border-primary"
        >
          {CONDITION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {canRemove && (
          <button
            onClick={onRemove}
            className="text-faint hover:text-danger cursor-pointer transition p-1 rounded-lg hover:bg-danger/10"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {needsThreshold && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-faint w-16">threshold</span>
          <input
            type={
              ["contains", "not_contains", "equals", "not_equals"].includes(
                cond.type,
              )
                ? "text"
                : "number"
            }
            value={c.threshold ?? ""}
            onChange={(e) =>
              onChange({
                ...cond,
                threshold:
                  e.target.type === "number"
                    ? parseFloat(e.target.value)
                    : e.target.value,
              } as Condition)
            }
            className="flex-1 bg-bg border border-border rounded-lg px-2 py-1 text-xs font-mono text-fg outline-none focus:border-primary transition"
          />
        </div>
      )}

      {needsRange && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-faint w-16">lo – hi</span>
          <input
            type="number"
            value={c.lo ?? ""}
            onChange={(e) =>
              onChange({ ...cond, lo: parseFloat(e.target.value) } as Condition)
            }
            className="flex-1 bg-bg border border-border rounded-lg px-2 py-1 text-xs font-mono text-fg outline-none focus:border-primary"
            placeholder="lo"
          />
          <span className="text-faint text-xs">–</span>
          <input
            type="number"
            value={c.hi ?? ""}
            onChange={(e) =>
              onChange({ ...cond, hi: parseFloat(e.target.value) } as Condition)
            }
            className="flex-1 bg-bg border border-border rounded-lg px-2 py-1 text-xs font-mono text-fg outline-none focus:border-primary"
            placeholder="hi"
          />
        </div>
      )}

      {needsPct && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-faint w-16">threshold</span>
          <input
            type="number"
            value={c.threshold ?? ""}
            onChange={(e) =>
              onChange({
                ...cond,
                threshold: parseFloat(e.target.value),
              } as Condition)
            }
            className="flex-1 bg-bg border border-border rounded-lg px-2 py-1 text-xs font-mono text-fg outline-none focus:border-primary"
          />
          <select
            value={c.direction ?? "any"}
            onChange={(e) =>
              onChange({ ...cond, direction: e.target.value } as Condition)
            }
            className="bg-bg border border-border rounded-lg px-2 py-1 text-xs text-fg outline-none cursor-pointer"
          >
            <option value="any">any</option>
            <option value="up">up</option>
            <option value="down">down</option>
          </select>
        </div>
      )}

      <input
        value={c.message ?? ""}
        onChange={(e) =>
          onChange({
            ...cond,
            message: e.target.value || undefined,
          } as Condition)
        }
        placeholder="Optional alert message"
        className="bg-bg border border-border/50 rounded-lg px-2 py-1 text-[10px] text-fg placeholder:text-faint outline-none focus:border-primary transition"
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-muted font-medium">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-elevated border border-border rounded-xl px-3 py-2 text-sm text-fg placeholder:text-faint outline-none focus:border-primary transition";
