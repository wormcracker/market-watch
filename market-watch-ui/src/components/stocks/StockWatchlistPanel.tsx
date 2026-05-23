"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPatch, apiPost } from "@/lib/api";
import { parseRemark, parseSlTp } from "@/lib/utils";
import type { WatchlistEntry, Position, Watch } from "@/lib/types";
import {
  Bookmark,
  BookmarkCheck,
  ChartNoAxesColumn,
  Target,
  Wallet,
  MessageSquare,
  Plus,
  X,
  Check,
  Pencil,
  Zap,
  Power,
  PowerOff,
  Edit2,
  Shield,
  Circle,
  Home,
  RefreshCw,
} from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────
type WatcherType = "ltp" | "sltp";

const WATCHER_TAGS: Record<WatcherType, string[]> = {
  ltp: ["stocks", "watchlist"],
  sltp: ["stocks", "portfolio"],
};
const WATCHER_SOUNDS: Record<WatcherType, string> = {
  ltp: "double-bell.mp3",
  sltp: "buzzer.mp3",
};

type Props = {
  symbol: string;
  watchlist: WatchlistEntry;
  position?: Position;
  ltpWatcher: Watch | null;
  slTpWatcher: Watch | null;
};

// ─── Patch types ──────────────────────────────────────────────────────────────

type PatchField = "watch" | "remark" | "targetCap" | "slTp" | "message";

type PatchBody = Partial<{
  watch: boolean;
  remark: string;
  targetCap: number;
  slTp: string;
  message: string;
}>;

// ─── Constants ────────────────────────────────────────────────────────────────

const RATING_META = [
  { key: "tech", label: "Technical", weight: 100, max: 3 },
  { key: "rr", label: "Risk:Reward", weight: 90, max: 6 },
  { key: "broker", label: "Broker", weight: 70, max: 3 },
  { key: "news", label: "News", weight: 50, max: 3 },
] as const;

const MAX_SCORE = 3 * 100 + 6 * 90 + 3 * 70 + 3 * 50; // with rr up to 6
const MAX_ENTRY_PRICES = 4;

export const LTP_WATCHER_NAME = (s: string) => `${s} [ltp]`;
export const SLTP_WATCHER_NAME = (s: string) => `${s} [sl/tp]`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeScore(ratings: [number, number, number, number]): number {
  return Math.round(
    (ratings.reduce((sum, r, i) => sum + r * RATING_META[i].weight, 0) /
      MAX_SCORE) *
      100,
  );
}

function scoreMeta(score: number): { label: string; cls: string } {
  if (score <= 33) return { label: "Low", cls: "bg-danger/10 text-danger" };
  if (score <= 66)
    return { label: "Medium", cls: "bg-warning/10 text-warning" };
  return { label: "Strong", cls: "bg-positive/10 text-positive" };
}

function barColor(score: number) {
  if (score <= 33) return "bg-danger";
  if (score <= 66) return "bg-warning";
  return "bg-positive";
}

function serializeRemark(
  prices: number[],
  ratings: [number, number, number, number],
): string {
  return `${prices.join(" / ")} (${ratings.join(", ")})`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function pctFromWacc(price: number, wacc: number): string {
  if (wacc === 0) return "—";
  const d = (((price - wacc) / wacc) * 100).toFixed(2);
  return `${parseFloat(d) >= 0 ? "+" : ""}${d}%`;
}

function buildWatcherBody(
  symbol: string,
  name: string,
  conditions: object[],
  type: WatcherType,
) {
  return {
    name,
    engine: "nepse",
    symbol,
    field: "ltp",
    conditions,
    tags: WATCHER_TAGS[type],
    customSound: WATCHER_SOUNDS[type],
    macSound: null,
  };
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl p-5 flex flex-col gap-4">
      {children}
    </div>
  );
}

function CardTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary opacity-60">{icon}</span>
      <p className="text-[10px] text-muted uppercase tracking-widest font-medium">
        {label}
      </p>
    </div>
  );
}

function Spinner({ color = "border-primary" }: { color?: string }) {
  return (
    <span
      className={`w-3.5 h-3.5 border-2 ${color} border-t-transparent rounded-full animate-spin block`}
    />
  );
}

function InlineInput({
  value,
  type = "text",
  placeholder,
  label,
  onSave,
  saving,
  multiline = false,
}: {
  value: string;
  type?: "text" | "number";
  placeholder?: string;
  label?: string;
  onSave: (v: string) => void;
  saving: boolean;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;

  function commit() {
    if (dirty) onSave(draft);
  }

  const cls = `
    w-full bg-elevated text-fg text-sm font-mono rounded-xl px-3 py-2.5 pr-9
    border border-transparent outline-none transition-all placeholder:text-faint
    focus:border-primary/40 focus:bg-surface2 resize-none
  `;

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[11px] text-muted">{label}</span>}
      <div className="relative">
        {multiline ? (
          <textarea
            rows={2}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            className={cls}
          />
        ) : (
          <input
            type={type}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commit();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className={cls}
          />
        )}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            commit();
          }}
          className={`absolute right-2.5 top-2.5 p-0.5 rounded-md transition
            ${dirty || saving ? "text-primary" : "text-faint hover:text-muted"}`}
        >
          {saving ? (
            <Spinner />
          ) : dirty ? (
            <Check size={13} />
          ) : (
            <Pencil size={12} />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── WatcherRow — embedded watcher UI ────────────────────────────────────────
// Accepts the initial watcher (may be null) passed from page.
// Handles create / enable / disable / edit internally.

function WatcherRow({
  symbol,
  name,
  initialWatcher,
  defaultConditions,
  type,
}: {
  symbol: string;
  name: string;
  initialWatcher: Watch | null;
  defaultConditions: object[];
  type: WatcherType;
}) {
  const qc = useQueryClient();

  // Re-fetch after mutations so UI stays live
  const { data: watcher } = useQuery({
    queryKey: ["watcher-by-name", name],
    queryFn: () =>
      apiFetch<Watch>(`watchers/watches/byName/${encodeURIComponent(name)}`),
    initialData: initialWatcher,
  });

  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const isOutside = "lo" in (defaultConditions[0] as Record<string, unknown>);

  // Editable values — seeded from current watcher conditions or defaults
  const seedCond = (watcher?.conditions?.[0] ?? defaultConditions[0]) as Record<
    string,
    unknown
  >;
  const [thresholdVal, setThresholdVal] = useState(
    String(isOutside ? (seedCond.lo ?? "") : (seedCond.threshold ?? "")),
  );
  const [hiVal, setHiVal] = useState(
    String(isOutside ? (seedCond.hi ?? "") : ""),
  );

  async function doCreate() {
    setSaving(true);
    try {
      await apiPost(
        "watchers/watches",
        buildWatcherBody(symbol, name, defaultConditions, type),
      );
      qc.invalidateQueries({ queryKey: ["watcher-by-name", name] });
    } finally {
      setSaving(false);
    }
  }

  async function doToggle() {
    if (!watcher) return;
    setSaving(true);
    try {
      await apiPost(
        `watchers/watches/${watcher.id}/${watcher.enabled ? "disable" : "enable"}`,
      );
      qc.invalidateQueries({ queryKey: ["watcher-by-name", name] });
    } finally {
      setSaving(false);
    }
  }

  async function doUpdate() {
    if (!watcher) return;
    setSaving(true);
    const newConds = isOutside
      ? [
          {
            type: "outside",
            lo: parseFloat(thresholdVal),
            hi: parseFloat(hiVal),
          },
        ]
      : [{ type: "below", threshold: parseFloat(thresholdVal) }];
    try {
      await apiPatch(
        `watchers/watches/${watcher.id}`,
        buildWatcherBody(symbol, name, newConds, type),
      );
      qc.invalidateQueries({ queryKey: ["watcher-by-name", name] });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      {/* label row */}
      <div className="flex items-center gap-1.5">
        <Zap size={11} className="text-secondary opacity-70" />
        <span className="text-[10px] font-mono text-muted truncate">
          {name}
        </span>
      </div>

      {/* existing watcher — status row */}
      {watcher && !editing && (
        <div
          className={`flex items-center justify-between rounded-xl px-3 py-2 border
            ${
              watcher.enabled
                ? "bg-secondary/5 border-secondary/20"
                : "bg-elevated border-border opacity-60"
            }`}
        >
          <div className="flex flex-col gap-0.5">
            <span
              className={`text-[10px] font-medium ${watcher.enabled ? "text-secondary" : "text-faint"}`}
            >
              {watcher.enabled ? "Active" : "Disabled"}
            </span>
            <span className="text-[10px] text-faint font-mono">
              {isOutside
                ? `outside ${seedCond.lo} / ${seedCond.hi}`
                : `below ${(watcher.conditions[0] as Record<string, unknown>).threshold}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg bg-elevated hover:bg-surface2 text-faint hover:text-fg transition"
            >
              <Edit2 size={11} />
            </button>
            <button
              onClick={doToggle}
              disabled={saving}
              className={`p-1.5 rounded-lg transition
                ${
                  watcher.enabled
                    ? "bg-danger/10 text-danger hover:bg-danger/20"
                    : "bg-positive/10 text-positive hover:bg-positive/20"
                }`}
            >
              {saving ? (
                <Spinner
                  color={watcher.enabled ? "border-danger" : "border-positive"}
                />
              ) : watcher.enabled ? (
                <PowerOff size={11} />
              ) : (
                <Power size={11} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* edit form */}
      {watcher && editing && (
        <div className="flex flex-col gap-2 bg-elevated rounded-xl p-3">
          {isOutside ? (
            <div className="flex flex-col gap-2">
              <input
                type="number"
                value={thresholdVal}
                placeholder="SL"
                onChange={(e) => setThresholdVal(e.target.value)}
                className="flex-1 bg-surface text-fg text-xs font-mono rounded-lg px-2 py-1.5
                           border border-border outline-none focus:border-primary/40"
              />
              <input
                type="number"
                value={hiVal}
                placeholder="TP"
                onChange={(e) => setHiVal(e.target.value)}
                className="flex-1 bg-surface text-fg text-xs font-mono rounded-lg px-2 py-1.5
                           border border-border outline-none focus:border-primary/40"
              />
            </div>
          ) : (
            <input
              type="number"
              value={thresholdVal}
              placeholder="Threshold"
              onChange={(e) => setThresholdVal(e.target.value)}
              className="bg-surface text-fg text-xs font-mono rounded-lg px-2 py-1.5
                         border border-border outline-none focus:border-primary/40 w-full"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 text-xs py-1.5 rounded-lg bg-surface2 text-muted hover:text-fg transition"
            >
              Cancel
            </button>
            <button
              onClick={doUpdate}
              disabled={saving}
              className="flex-1 text-xs py-1.5 rounded-lg bg-secondary/10 border border-secondary/30
                         text-secondary hover:bg-secondary/20 transition flex items-center justify-center gap-1"
            >
              {saving ? (
                <Spinner color="border-secondary" />
              ) : (
                <Check size={11} />
              )}
              Save
            </button>
          </div>
        </div>
      )}

      {/* no watcher yet */}
      {!watcher && (
        <button
          onClick={doCreate}
          disabled={saving}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl
                     bg-secondary/8 border border-secondary/20 border-dashed
                     text-secondary text-xs hover:bg-secondary/15 transition"
        >
          {saving ? <Spinner color="border-secondary" /> : <Zap size={11} />}
          Create watcher
        </button>
      )}
    </div>
  );
}

// ─── EntryPriceQuickUpdate ────────────────────────────────────────────────────
// A compact card for each entry price with a quick-update button that patches
// the LTP watcher's threshold to that price without touching the rest.

function EntryPriceQuickUpdate({
  symbol,
  price,
  isMain,
  watcher,
}: {
  symbol: string;
  price: number;
  isMain: boolean;
  watcher: Watch | null;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const name = LTP_WATCHER_NAME(symbol);

  const above = Math.floor(price * 1.02);

  async function doApply() {
    if (!watcher) return;
    setSaving(true);
    try {
      await apiPatch(
        `watchers/watches/${watcher.id}`,
        buildWatcherBody(
          symbol,
          name,
          [{ type: "below", threshold: above }],
          "ltp",
        ),
      );
      qc.invalidateQueries({ queryKey: ["watcher-by-name", name] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`flex items-center justify-between rounded-xl px-3 py-2 border
        ${isMain ? "bg-primary/5 border-primary/20" : "bg-elevated border-border"}`}
    >
      <div className="flex flex-col gap-0.5">
        {isMain && (
          <span className="text-[9px] text-primary uppercase tracking-wider font-semibold">
            main
          </span>
        )}
        <span className="text-xs font-mono text-fg font-medium">
          Rs {fmt(price)}
        </span>
        <span className="text-[10px] font-mono text-faint">
          +2% Rs {fmt(above)}
        </span>
      </div>

      <button
        onClick={doApply}
        disabled={saving || !watcher}
        title={watcher ? `Set threshold to ${price}` : "Create watcher first"}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] transition
          ${
            watcher
              ? "bg-secondary/10 border border-secondary/25 text-secondary hover:bg-secondary/20"
              : "bg-elevated border border-border text-faint cursor-not-allowed"
          }`}
      >
        {saving ? (
          <Spinner color="border-secondary" />
        ) : (
          <RefreshCw size={10} />
        )}
        Apply
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card 1 — Watch toggle + entry prices quick-update + LTP watcher
// ─────────────────────────────────────────────────────────────────────────────

function WatchCard({
  symbol,
  watching,
  entryPrices,
  saving,
  onToggle,
  ltpWatcher,
}: {
  symbol: string;
  watching: boolean;
  entryPrices: number[];
  saving: boolean;
  onToggle: () => void;
  ltpWatcher: Watch | null;
}) {
  // We need the live watcher for quick-update buttons — keep a reactive copy
  const { data: liveWatcher } = useQuery({
    queryKey: ["watcher-by-name", LTP_WATCHER_NAME(symbol)],
    queryFn: () =>
      apiFetch<Watch>(
        `watchers/watches/byName/${encodeURIComponent(LTP_WATCHER_NAME(symbol))}`,
      ),
    initialData: ltpWatcher ?? undefined,
  });

  return (
    <CardShell>
      <CardTitle icon={<Bookmark size={13} />} label="Watchlist" />

      <button
        onClick={onToggle}
        disabled={saving}
        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all
          ${
            watching
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-elevated border-border text-muted hover:text-fg"
          }`}
      >
        <div className="flex items-center gap-2.5">
          {watching ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          <span className="text-sm font-medium">
            {watching ? "Watching" : "Not Watching"}
          </span>
        </div>
        {saving ? (
          <Spinner />
        ) : (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium
              ${watching ? "bg-primary/20 text-primary" : "bg-surface2 text-faint"}`}
          >
            {watching ? "ON" : "OFF"}
          </span>
        )}
      </button>

      {/* Entry price quick-update cards — only shown when watching and prices exist */}
      {watching && entryPrices.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] text-muted uppercase tracking-widest">
            Entry Prices
          </span>
          {entryPrices.map((price, idx) => (
            <EntryPriceQuickUpdate
              key={price}
              symbol={symbol}
              price={price}
              isMain={idx === 0}
              watcher={liveWatcher ?? null}
            />
          ))}
        </div>
      )}

      {/* LTP watcher — only relevant when watching */}
      {watching && (
        <WatcherRow
          symbol={symbol}
          name={LTP_WATCHER_NAME(symbol)}
          initialWatcher={ltpWatcher}
          defaultConditions={[
            { type: "below", threshold: entryPrices[0] ?? 0 },
          ]}
          type="ltp"
        />
      )}
    </CardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card 2 — Analysis (ratings + entry prices)
// ─────────────────────────────────────────────────────────────────────────────

function AnalysisCard({
  watchlist,
  saving,
  onSave,
}: {
  watchlist: WatchlistEntry;
  saving: boolean;
  onSave: (remark: string) => void;
}) {
  const parsed = parseRemark(watchlist.remark);
  const [prices, setPrices] = useState<number[]>(parsed?.entryPrices ?? []);
  const [ratings, setRatings] = useState<[number, number, number, number]>(
    parsed?.ratings ?? [1, 1, 1, 1],
  );
  const [priceInput, setPriceInput] = useState("");
  const [priceError, setPriceError] = useState("");

  const score = computeScore(ratings);
  const { label, cls } = scoreMeta(score);

  function doSave(p: number[], r: typeof ratings) {
    if (p.length === 0) return;
    onSave(serializeRemark(p, r));
  }

  function handleAddPrice() {
    const raw = priceInput.trim();
    if (raw === "") {
      setPriceError("Cannot be empty");
      return;
    }

    const val = parseFloat(raw);
    if (isNaN(val) || val <= 0) {
      setPriceError("Enter a valid price");
      return;
    }
    if (prices.length > 0 && val >= prices[prices.length - 1]) {
      setPriceError(`Must be lower than ${prices[prices.length - 1]}`);
      return;
    }
    if (prices.length >= MAX_ENTRY_PRICES) {
      setPriceError(`Max ${MAX_ENTRY_PRICES} prices`);
      return;
    }
    const next = [...prices, val];
    setPrices(next);
    setPriceInput("");
    setPriceError("");
    doSave(next, ratings);
  }

  function handleRemovePrice(idx: number) {
    const next = prices.slice(0, idx);
    setPrices(next);
    doSave(next, ratings);
  }

  function handleRating(i: number, val: number) {
    const next = [...ratings] as [number, number, number, number];
    next[i] = val;
    setRatings(next);
    doSave(prices, next);
  }

  return (
    <CardShell>
      <CardTitle icon={<ChartNoAxesColumn size={13} />} label="Analysis" />

      {/* Score */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">Conviction Score</span>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-full ${cls}`}
          >
            {score} / 100
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${cls}`}>
            {label}
          </span>
        </div>
      </div>
      <div className="h-1 bg-elevated rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Ratings */}
      <div className="flex flex-col gap-3">
        {RATING_META.map((meta, i) => (
          <div key={meta.key} className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted">{meta.label}</p>
              <p className="text-[10px] text-faint">weight {meta.weight}</p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: meta.max }, (_, v) => v + 1).map((val) => (
                <button
                  key={val}
                  onClick={() => handleRating(i, val)}
                  className={`w-7 h-6 text-[11px] rounded-lg border transition-all font-mono
                    ${
                      ratings[i] === val
                        ? "bg-primary/20 border-primary/50 text-primary font-semibold"
                        : "bg-elevated border-border text-faint hover:border-muted hover:text-fg"
                    }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Entry prices */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Entry Prices</span>
          <span className="text-[10px] text-faint">
            {prices.length}/{MAX_ENTRY_PRICES} · each lower than previous
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {prices.map((p, idx) => (
            <span
              key={idx}
              className="flex items-center gap-1.5 text-[11px] font-mono bg-elevated
                         text-fg px-2.5 py-1 rounded-lg border border-border"
            >
              {idx === 0 && (
                <span className="text-[9px] text-primary uppercase tracking-wider">
                  main
                </span>
              )}
              Rs {fmt(p)}
              <button
                onClick={() => handleRemovePrice(idx)}
                className="text-faint hover:text-danger transition"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {prices.length === 0 && (
            <span className="text-[11px] text-faint italic">No prices set</span>
          )}
        </div>

        {prices.length < MAX_ENTRY_PRICES && (
          <div className="flex gap-2">
            <input
              type="number"
              value={priceInput}
              placeholder={
                prices.length === 0
                  ? "e.g. 855"
                  : `< ${prices[prices.length - 1]}`
              }
              onChange={(e) => {
                setPriceInput(e.target.value);
                setPriceError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddPrice();
              }}
              className={`flex-1 bg-elevated text-fg text-sm font-mono rounded-xl px-3 py-2
                border outline-none transition-all placeholder:text-faint focus:bg-surface2
                ${priceError ? "border-danger/50" : "border-transparent focus:border-primary/40"}`}
            />
            <button
              onClick={handleAddPrice}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl
                         bg-primary/10 border border-primary/30 text-primary
                         text-xs hover:bg-primary/20 transition"
            >
              {saving ? <Spinner /> : <Plus size={13} />}
              Add
            </button>
          </div>
        )}
        {priceError && <p className="text-[11px] text-danger">{priceError}</p>}
      </div>
    </CardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card 3 — SL / TP + SL/TP watcher (portfolio-gated)
// ─────────────────────────────────────────────────────────────────────────────

function SlTpCard({
  symbol,
  watchlist,
  position,
  saving,
  onSave,
  slTpWatcher,
}: {
  symbol: string;
  watchlist: WatchlistEntry;
  position: Position;
  saving: boolean;
  onSave: (s: string) => void;
  slTpWatcher: Watch | null;
}) {
  const parsed = parseSlTp(watchlist.slTp);
  const wacc = position.avgBuy;
  const ltp = watchlist.ltp;

  const [slVal, setSlVal] = useState(String(parsed?.sl ?? ""));
  const [tpVal, setTpVal] = useState(String(parsed?.tp ?? ""));
  const [slErr, setSlErr] = useState("");
  const [tpErr, setTpErr] = useState("");

  function doSave(sl: string, tp: string) {
    const s = parseFloat(sl),
      t = parseFloat(tp);
    if (isNaN(s) || s <= 0) {
      setSlErr("Invalid SL");
      return;
    }
    if (isNaN(t) || t <= 0) {
      setTpErr("Invalid TP");
      return;
    }
    if (s >= wacc) {
      setSlErr("SL must be below WACC");
      return;
    }
    if (t <= wacc) {
      setTpErr("TP must be above WACC");
      return;
    }
    setSlErr("");
    setTpErr("");
    onSave(`${s}, ${t}`);
  }

  const sl = parseFloat(slVal);
  const tp = parseFloat(tpVal);
  const hasBar = !isNaN(sl) && !isNaN(tp) && sl > 0 && tp > sl;
  const rr =
    hasBar && wacc > sl ? ((tp - wacc) / (wacc - sl)).toFixed(2) : null;

  // Default watcher conditions: use parsed SL/TP or WACC ±%
  const defaultSl = parsed?.sl ?? Math.round(wacc * 0.98);
  const defaultTp = parsed?.tp ?? Math.round(wacc * 1.08);

  return (
    <CardShell>
      <CardTitle icon={<Target size={13} />} label="Stop Loss / Target" />

      {/* WACC reference */}
      <div className="flex justify-between">
        <div className="flex items-center justify-between bg-elevated rounded-xl px-3 py-2.5">
          <span className="text-[11px] text-muted pr-5">BUY </span>
          <span className="text-sm font-mono text-fg font-semibold">
            Rs {fmt(wacc)}
          </span>
        </div>
        <div className="flex items-center justify-between bg-elevated rounded-xl px-3 py-2.5">
          <span className="text-[11px] text-muted pr-5">LTP</span>
          <span className="text-sm font-mono text-fg font-semibold">
            Rs {fmt(ltp)}
          </span>
        </div>
      </div>

      {/* visual bar */}
      {hasBar && <SlTpBar sl={sl} tp={tp} wacc={wacc} ltp={ltp} />}

      {/* SL input */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">Stop Loss</span>
          {!isNaN(sl) && sl > 0 && (
            <span className="text-[10px] font-mono text-danger">
              {pctFromWacc(sl, wacc)} from WACC
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={slVal}
            placeholder="e.g. 830"
            onChange={(e) => {
              setSlVal(e.target.value);
              setSlErr("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSave(slVal, tpVal);
            }}
            className={`flex-1 bg-elevated text-fg text-sm font-mono rounded-xl px-3 py-2
              border outline-none transition-all placeholder:text-faint focus:bg-surface2
              ${slErr ? "border-danger/50" : "border-transparent focus:border-danger/40"}`}
          />
          <button
            onClick={() => doSave(slVal, tpVal)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-danger/10
                       border border-danger/30 text-danger text-xs hover:bg-danger/20 transition shrink-0"
          >
            {saving ? <Spinner color="border-danger" /> : <Check size={13} />}
            Set SL
          </button>
        </div>
        {slErr && <p className="text-[11px] text-danger">{slErr}</p>}
      </div>

      {/* TP input */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">Target Price</span>
          {!isNaN(tp) && tp > 0 && (
            <span className="text-[10px] font-mono text-positive">
              {pctFromWacc(tp, wacc)} from WACC
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={tpVal}
            placeholder="e.g. 1100"
            onChange={(e) => {
              setTpVal(e.target.value);
              setTpErr("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSave(slVal, tpVal);
            }}
            className={`flex-1 bg-elevated text-fg text-sm font-mono rounded-xl px-3 py-2
              border outline-none transition-all placeholder:text-faint focus:bg-surface2
              ${tpErr ? "border-danger/50" : "border-transparent focus:border-positive/40"}`}
          />
          <button
            onClick={() => doSave(slVal, tpVal)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-positive/10
                       border border-positive/30 text-positive text-xs hover:bg-positive/20 transition shrink-0"
          >
            {saving ? <Spinner color="border-positive" /> : <Check size={13} />}
            Set TP
          </button>
        </div>
        {tpErr && <p className="text-[11px] text-danger">{tpErr}</p>}
      </div>

      {/* R:R */}
      {rr && (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-[11px] text-muted">Risk : Reward</span>
          <span className="text-sm font-mono font-semibold text-fg">
            1 : {rr}
          </span>
        </div>
      )}

      {/* SL/TP watcher */}
      <WatcherRow
        symbol={symbol}
        name={SLTP_WATCHER_NAME(symbol)}
        initialWatcher={slTpWatcher}
        defaultConditions={[{ type: "outside", lo: defaultSl, hi: defaultTp }]}
        type="sltp"
      />
    </CardShell>
  );
}

function SlTpBar({
  sl,
  tp,
  wacc,
  ltp,
}: {
  sl: number;
  tp: number;
  wacc: number;
  ltp: number;
}) {
  const all = [sl, wacc, ltp, tp];
  const min = Math.min(...all) * 0.985;
  const max = Math.max(...all) * 1.015;
  const span = max - min;
  const pct = (v: number) => `${(((v - min) / span) * 100).toFixed(1)}%`;

  const leftEdge = Math.min(wacc, ltp);
  const rightEdge = Math.max(wacc, ltp);

  return (
    <div className="relative h-8 flex items-center">
      <div className="absolute inset-x-0 h-[3px] bg-elevated rounded-full" />
      {/* danger zone: SL → leftEdge */}
      <div
        className="absolute h-[3px] bg-danger/30 rounded-full"
        style={{ left: pct(sl), width: `calc(${pct(leftEdge)} - ${pct(sl)})` }}
      />
      {/* progress zone: WACC ↔ LTP */}
      <div
        className="absolute h-[3px] bg-primary/30 rounded-full"
        style={{
          left: pct(leftEdge),
          width: `calc(${pct(rightEdge)} - ${pct(leftEdge)})`,
        }}
      />
      {/* gain zone: rightEdge → TP */}
      <div
        className="absolute h-[3px] bg-positive/30 rounded-full"
        style={{
          left: pct(rightEdge),
          width: `calc(${pct(tp)} - ${pct(rightEdge)})`,
        }}
      />
      <Marker pos={pct(sl)} type="sl" label="SL" />
      <Marker pos={pct(wacc)} type="wacc" label="Cost" />
      <Marker pos={pct(ltp)} type="ltp" label="LTP" />
      <Marker pos={pct(tp)} type="tp" label="TP" />
    </div>
  );
}

function Marker({
  pos,
  label,
  type,
}: {
  pos: string;
  label: string;
  type: "sl" | "wacc" | "ltp" | "tp";
}) {
  const config = {
    sl: {
      color: "#ef4444",
      Icon: X,
      text: "End",
      textColor: "text-danger",
    },
    wacc: {
      color: "#3b82f6",
      Icon: Shield,
      text: "Safe",
      textColor: "text-primary",
    },
    ltp: {
      color: "#f59e0b",
      Icon: Circle,
      text: "You",
      textColor: "text-warning",
    },
    tp: {
      color: "#22c55e",
      Icon: Home,
      text: "Home",
      textColor: "text-positive",
    },
  }[type];

  const Icon = config.Icon;

  return (
    <div
      className="absolute -translate-x-1/2 flex flex-col items-center"
      style={{ left: pos }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill={config.color} opacity="0.18" />
      </svg>

      <div style={{ color: config.color }} className="absolute">
        <Icon size={14} strokeWidth={1.8} />
      </div>

      <p
        className={`text-[10px] mt-1 ${config.textColor} bg-surface2 px-2 rounded-2xl border-border font-bold uppercase tracking-wide`}
      >
        {label ?? config.text}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card 4 — Target Capital
// ─────────────────────────────────────────────────────────────────────────────

function TargetCapCard({
  watchlist,
  position,
  saving,
  onSave,
}: {
  watchlist: WatchlistEntry;
  position?: Position;
  saving: boolean;
  onSave: (n: number) => void;
}) {
  const targetRs = watchlist.targetCap * 1000;
  const investedRs = position ? position.qty * position.avgBuy : 0;
  const used = targetRs > 0 ? Math.min((investedRs / targetRs) * 100, 100) : 0;
  const overshot = position ? investedRs > targetRs : false;
  const remaining = Math.max(targetRs - investedRs, 0);

  return (
    <CardShell>
      <CardTitle icon={<Wallet size={13} />} label="Target Capital" />

      {position && (
        <div className="flex flex-col gap-2">
          <CapRow label="Target Cap" value={`Rs ${fmt(targetRs)}`} />
          <CapRow
            label="Invested (WACC)"
            value={`Rs ${fmt(Math.round(investedRs))}`}
          />
          <CapRow
            label={overshot ? "Exceeded by" : "Available"}
            value={`Rs ${fmt(Math.round(overshot ? investedRs - targetRs : remaining))}`}
            hi={overshot ? "danger" : "positive"}
          />
          <div className="mt-1">
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-faint">Utilisation</span>
              <span
                className={`text-[10px] font-mono ${overshot ? "text-danger" : "text-muted"}`}
              >
                {Math.round(used)}%
              </span>
            </div>
            <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500
                  ${overshot ? "bg-danger" : "bg-primary"}`}
                style={{ width: `${used}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <InlineInput
        value={String(watchlist.targetCap)}
        type="number"
        label="Max Capital (thousands — 1500 = Rs 15L)"
        placeholder="e.g. 1500"
        onSave={(v) => {
          const n = parseFloat(v);
          if (!isNaN(n) && n > 0) onSave(n);
        }}
        saving={saving}
      />
    </CardShell>
  );
}

function CapRow({
  label,
  value,
  hi,
}: {
  label: string;
  value: string;
  hi?: "danger" | "positive";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span
        className={`text-sm font-mono font-medium
        ${hi === "danger" ? "text-danger" : hi === "positive" ? "text-positive" : "text-fg"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card 5 — Note
// ─────────────────────────────────────────────────────────────────────────────

function NoteCard({
  watchlist,
  saving,
  onSave,
}: {
  watchlist: WatchlistEntry;
  saving: boolean;
  onSave: (v: string) => void;
}) {
  return (
    <CardShell>
      <CardTitle icon={<MessageSquare size={13} />} label="Note" />
      {watchlist.message && (
        <p
          className="text-xs text-warning bg-warning/8 border border-warning/20
                       rounded-xl px-3 py-2 leading-relaxed"
        >
          {watchlist.message}
        </p>
      )}
      <InlineInput
        value={watchlist.message}
        placeholder="Add a note for market time..."
        onSave={onSave}
        saving={saving}
        multiline
      />
    </CardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────────

export function StockWatchlistPanel({
  symbol,
  watchlist,
  position,
  ltpWatcher,
  slTpWatcher,
}: Props) {
  const qc = useQueryClient();
  const [savingField, setSavingField] = useState<PatchField | null>(null);

  const patch = useCallback(
    async (field: PatchField, body: PatchBody) => {
      setSavingField(field);
      try {
        await apiPatch(`stocks/watchlist/${symbol}`, body);
        qc.invalidateQueries({ queryKey: ["watchlist", symbol] });
      } finally {
        setSavingField(null);
      }
    },
    [symbol, qc],
  );

  const entryPrices = parseRemark(watchlist.remark)?.entryPrices ?? [];

  return (
    <div className="flex flex-row gap-4 items-start flex-wrap">
      <div className="gap-4 flex flex-col">
        <WatchCard
          symbol={symbol}
          watching={watchlist.watch}
          entryPrices={entryPrices}
          saving={savingField === "watch"}
          onToggle={() => patch("watch", { watch: !watchlist.watch })}
          ltpWatcher={ltpWatcher}
        />
        <NoteCard
          watchlist={watchlist}
          saving={savingField === "message"}
          onSave={(v) => patch("message", { message: v })}
        />
      </div>
      <AnalysisCard
        watchlist={watchlist}
        saving={savingField === "remark"}
        onSave={(remark) => patch("remark", { remark })}
      />

      {watchlist.inPortfolio && position && (
        <SlTpCard
          symbol={symbol}
          watchlist={watchlist}
          position={position}
          saving={savingField === "slTp"}
          onSave={(slTp) => patch("slTp", { slTp })}
          slTpWatcher={slTpWatcher}
        />
      )}

      <TargetCapCard
        watchlist={watchlist}
        position={position}
        saving={savingField === "targetCap"}
        onSave={(n) => patch("targetCap", { targetCap: n })}
      />
    </div>
  );
}
