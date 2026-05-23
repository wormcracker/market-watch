"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "@/lib/api";
import { parseRemark, parseSlTp } from "@/lib/utils";
import type { WatchlistEntry, Position } from "@/lib/types";
import {
  ShoppingCart,
  TrendingDown,
  RefreshCw,
  Minus,
  Plus,
  Zap,
  Loader2,
} from "lucide-react";

/* ───────────────────────────────────────────── */
/* TYPES */
/* ───────────────────────────────────────────── */

type Props = {
  symbol: string;
  watchlist: WatchlistEntry;
  position?: Position;
};

type Mode = "buy" | "sell";

type BuyState = {
  qty: number;
  totalCost: number;
  commission: number;
  newWacc: number;
};

type SellState = {
  qty: number;
  totalSell: number;
  commission: number;
  cgt: number;
  netPl: number;
  plPct: number;
  holdingDays: number;
};

// Per-row data fetched from /preview
type RowPreview = {
  qty: number;
  gross: number;
  commission: number;
  totalCost: number;
};

/* ───────────────────────────────────────────── */
/* HELPERS */
/* ───────────────────────────────────────────── */

function fmt(n?: number, d = 2) {
  if (n == null || Number.isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function fmtInt(n?: number) {
  return Math.round(n || 0).toLocaleString("en-IN");
}

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Only used for qty estimation before preview fetch
function estimateBuyFee(gross: number) {
  return gross * 0.004 + gross * 0.00015;
}

function maxQtyInsideCap(price: number, cap: number) {
  if (price <= 0 || cap <= 0) return 0;
  let lo = 0;
  let hi = Math.floor(cap / price);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const gross = mid * price;
    const fee = estimateBuyFee(gross);
    if (gross + fee <= cap) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function parseBuyPreview(raw: any, current?: Position): BuyState {
  const arr = raw?.preview || raw?.data?.preview;
  if (Array.isArray(arr)) {
    return {
      qty: num(arr[4]),
      newWacc: num(arr[5]),
      totalCost: num(arr[6]),
      commission: num(arr[10]),
    };
  }
  const qty = num(raw?.qty);
  const totalCost = num(raw?.totalCost);
  const commission = num(raw?.commission);
  const newQty = (current?.qty || 0) + qty;
  const newCost = (current?.avgBuy || 0) * (current?.qty || 0) + totalCost;
  return { qty, totalCost, commission, newWacc: newQty ? newCost / newQty : 0 };
}

function parseRowPreview(raw: any): RowPreview | null {
  const arr = raw?.preview || raw?.data?.preview;
  if (Array.isArray(arr)) {
    const qty = num(arr[4]);
    const commission = num(arr[10]);
    const totalCost = num(arr[6]);
    const gross = totalCost - commission;
    return { qty, gross, commission, totalCost };
  }
  const qty = num(raw?.qty);
  if (!qty) return null;
  const totalCost = num(raw?.totalCost);
  const commission = num(raw?.commission);
  const gross = totalCost - commission;
  return { qty, gross, commission, totalCost };
}

function parseSellPreview(raw: any): SellState {
  const arr = raw?.preview || raw?.data?.preview;
  if (Array.isArray(arr)) {
    return {
      qty: num(arr[4]),
      totalSell: num(arr[8]),
      commission: num(arr[10]),
      cgt: num(arr[11]),
      netPl: num(arr[12]),
      plPct: num(arr[13]),
      holdingDays: 0,
    };
  }
  return {
    qty: 0,
    totalSell: 0,
    commission: 0,
    cgt: 0,
    netPl: 0,
    plPct: 0,
    holdingDays: 0,
  };
}

function defaultSplit(n: number): number[] {
  if (n === 2) return [30, 70];
  if (n === 3) return [20, 50, 30];
  if (n === 4) return [10, 30, 20, 40];
  const base = Math.floor(100 / n);
  const arr = Array.from({ length: n }, () => base);
  arr[n - 1] += 100 - arr.reduce((a, b) => a + b, 0);
  return arr;
}

// ─── Slider update logic ──────────────────────────────────────────────────────
//
// Slider N-1 is ALWAYS the passive absorber — never interactive.
// When slider i (0 ≤ i ≤ N-2) is dragged to `val`:
//   • Sliders 0 .. i-1    → LOCKED (frozen at their current values)
//   • Slider  i           → set to `val` (clamped so locked_sum + val ≤ 100)
//   • Sliders i+1 .. N-2  → share leftover equally (round-robin remainder)
//   • Slider  N-1         → absorbs whatever is truly left
//
// Example with 4 sliders (indices 0,1,2,3):
//   Drag slider 0 → [val, equal, equal, absorb]
//   Drag slider 1 → [locked, val, equal, absorb]
//   Drag slider 2 → [locked, locked, val, absorb]
//   Slider 3 is disabled — never draggable.

function computeNewSplit(
  prev: number[],
  draggedIdx: number,
  rawVal: number,
): number[] {
  const n = prev.length;
  if (n < 2) return prev;

  const lastIdx = n - 1;

  // Sum of locked sliders (everything before draggedIdx)
  const lockedSum = prev.slice(0, draggedIdx).reduce((s, v) => s + v, 0);

  // Clamp: locked + val must not exceed 100
  const val = Math.max(0, Math.min(rawVal, 100 - lockedSum));

  const next = [...prev];
  next[draggedIdx] = val;

  // Free interactive sliders: draggedIdx+1 .. N-2 (not the passive absorber)
  const freeIndices: number[] = [];
  for (let i = draggedIdx + 1; i < lastIdx; i++) freeIndices.push(i);

  const leftoverForFree = Math.max(0, 100 - lockedSum - val);

  if (freeIndices.length > 0) {
    const share = Math.floor(leftoverForFree / freeIndices.length);
    let remainder = leftoverForFree - share * freeIndices.length;
    for (const i of freeIndices) {
      next[i] = share + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }
  }

  // Passive absorber always gets the true remainder
  const usedSum = next.slice(0, lastIdx).reduce((s, v) => s + v, 0);
  next[lastIdx] = Math.max(0, 100 - usedSum);

  return next;
}

/* ───────────────────────────────────────────── */
/* UI primitives */
/* ───────────────────────────────────────────── */

function Row({
  label,
  value,
  sub,
  bold,
  separator,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  separator?: boolean;
  color?: string;
}) {
  return (
    <>
      {separator && <div className="h-px bg-border my-1" />}
      <div className="flex items-center justify-between py-1">
        <span className="text-[11px] text-muted">{label}</span>
        <div className="text-right">
          <div
            className={`text-xs font-mono ${bold ? "font-semibold" : ""} ${color || "text-fg"}`}
          >
            {value}
          </div>
          {sub && <div className="text-[10px] text-faint font-mono">{sub}</div>}
        </div>
      </div>
    </>
  );
}

function NumInput({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
  prefix?: string;
}) {
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  function commit(v: string) {
    if (v === "") return;
    const n = Number(v);
    if (!Number.isNaN(n) && n >= min) onChange(n);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-[11px] text-muted">{label}</span>}
      <div className="flex items-center rounded-xl border border-border bg-elevated overflow-hidden">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="px-3 py-2"
        >
          <Minus size={12} />
        </button>
        <div className="flex-1 flex items-center justify-center gap-1 px-2">
          {prefix && <span className="text-[11px] text-faint">{prefix}</span>}
          <input
            type="number"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => commit(raw)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(raw);
            }}
            className="w-full text-center bg-transparent outline-none text-sm font-mono"
          />
        </div>
        <button onClick={() => onChange(value + step)} className="px-3 py-2">
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────── */
/* SPLIT SLIDER */
/* ───────────────────────────────────────────── */

function SplitSlider({
  symbol,
  entryPrices,
  split,
  cap,
  onChange,
}: {
  symbol: string;
  entryPrices: number[];
  split: number[];
  cap: number;
  onChange: (idx: number, val: number) => void;
}) {
  const n = entryPrices.length;
  const lastIdx = n - 1;

  const [rowPreviews, setRowPreviews] = useState<(RowPreview | null)[]>(() =>
    Array(n).fill(null),
  );
  const [rowLoading, setRowLoading] = useState<boolean[]>(() =>
    Array(n).fill(false),
  );
  const timers = useRef<(ReturnType<typeof setTimeout> | null)[]>(
    Array(n).fill(null),
  );

  async function fetchRowPreview(idx: number, price: number, qty: number) {
    if (qty <= 0 || price <= 0) {
      setRowPreviews((p) => {
        const next = [...p];
        next[idx] = null;
        return next;
      });
      return;
    }
    setRowLoading((p) => {
      const next = [...p];
      next[idx] = true;
      return next;
    });
    try {
      const res = await apiPost<any>("stocks/trades/preview", {
        symbol,
        type: "buy",
        qty,
        price,
      });
      const parsed = parseRowPreview(res?.data || res);
      setRowPreviews((p) => {
        const next = [...p];
        next[idx] = parsed;
        return next;
      });
    } catch {
      setRowPreviews((p) => {
        const next = [...p];
        next[idx] = null;
        return next;
      });
    } finally {
      setRowLoading((p) => {
        const next = [...p];
        next[idx] = false;
        return next;
      });
    }
  }

  // Debounce-fetch per row whenever split or cap changes
  useEffect(() => {
    entryPrices.forEach((price, i) => {
      const part = (cap * split[i]) / 100;
      const qty = maxQtyInsideCap(price, part);
      if (timers.current[i]) clearTimeout(timers.current[i]!);
      timers.current[i] = setTimeout(() => fetchRowPreview(i, price, qty), 400);
    });
    return () => {
      timers.current.forEach((t) => {
        if (t) clearTimeout(t);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split, cap]);

  const totalQty = rowPreviews.reduce((s, r) => s + (r?.qty ?? 0), 0);
  const totalCost = rowPreviews.reduce((s, r) => s + (r?.totalCost ?? 0), 0);
  const anyPreview = rowPreviews.some((r) => r !== null);

  return (
    <div className="bg-elevated rounded-xl p-3 space-y-4">
      <div className="text-[10px] uppercase tracking-wider text-faint">
        Capital Split
      </div>

      {entryPrices.map((price, i) => {
        const isPassive = i === lastIdx;
        const pct = split[i];
        const preview = rowPreviews[i];
        const loading = rowLoading[i];

        return (
          <div key={i} className="flex flex-col gap-1.5">
            {/* Label row */}
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-faint">
                <span className="font-mono">Rs {fmtInt(price)}</span>
                {i === 0 && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    main
                  </span>
                )}
                {isPassive && (
                  <span className="text-[9px] bg-border text-faint px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    absorber
                  </span>
                )}
              </div>
              <span
                className={`font-mono tabular-nums font-semibold ${isPassive ? "text-faint/50" : "text-fg"}`}
              >
                {pct}%
              </span>
            </div>

            {/* Slider track + thumb */}
            <div className="relative flex items-center h-5">
              <div className="absolute inset-x-0 h-1.5 rounded-full bg-border" />
              <div
                className="absolute h-1.5 rounded-full transition-all duration-150 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isPassive
                    ? "color-mix(in srgb, var(--color-primary, #6366f1) 25%, transparent)"
                    : "var(--color-primary, #6366f1)",
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={pct}
                disabled={isPassive}
                onChange={(e) => onChange(i, Number(e.target.value))}
                className={[
                  "relative w-full appearance-none bg-transparent h-5 outline-none",
                  "[&::-webkit-slider-thumb]:appearance-none",
                  "[&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:h-[18px]",
                  "[&::-webkit-slider-thumb]:rounded-full",
                  "[&::-webkit-slider-thumb]:bg-[var(--color-primary,#6366f1)]",
                  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface",
                  "[&::-webkit-slider-thumb]:shadow-sm",
                  "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:ease-out",
                  "[&:active::-webkit-slider-thumb]:scale-125",
                  "[&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:h-[18px]",
                  "[&::-moz-range-thumb]:rounded-full",
                  "[&::-moz-range-thumb]:bg-[var(--color-primary,#6366f1)]",
                  "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface",
                  "[&::-moz-range-thumb]:shadow-sm",
                  isPassive
                    ? "opacity-25 cursor-not-allowed pointer-events-none"
                    : "cursor-pointer",
                ].join(" ")}
              />
            </div>

            {/* Preview row */}
            <div className="flex items-center justify-between text-[11px] font-mono min-h-[18px]">
              {loading ? (
                <span className="flex items-center gap-1 text-faint">
                  <Loader2 size={10} className="animate-spin" />
                  fetching...
                </span>
              ) : preview ? (
                <>
                  <span className="text-faint">
                    Cost{" "}
                    <span className="text-fg">
                      Rs {fmtInt(preview.totalCost)}
                    </span>
                  </span>
                  <span className="text-faint">
                    Qty{" "}
                    <span className="text-fg font-semibold">{preview.qty}</span>
                  </span>
                </>
              ) : (
                <span className="text-faint/40 text-[10px]">—</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Totals */}
      {anyPreview && (
        <div className="border-t border-border pt-3 flex justify-between text-[11px] font-mono">
          <span className="text-faint">
            Total qty <span className="text-fg font-semibold">{totalQty}</span>
          </span>
          <span className="text-faint">
            Total cost <span className="text-fg">Rs {fmtInt(totalCost)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────── */
/* BUY */
/* ───────────────────────────────────────────── */

function BuySection({
  symbol,
  watchlist,
  position,
}: {
  symbol: string;
  watchlist: WatchlistEntry;
  position?: Position;
}) {
  const parsed = parseRemark(watchlist.remark);
  const entryPrices = parsed?.entryPrices ?? [];

  const baseCap = watchlist.targetCap * 1000;
  const invested =
    position && position.qty && position.avgBuy
      ? position.qty * position.avgBuy
      : 0;
  const leftover = Math.max(0, baseCap - invested);
  const leftoverK = Math.floor(leftover / 1000);
  const initialCapK = position ? leftoverK : Math.floor(baseCap / 1000);

  const [capK, setCapK] = useState(initialCapK);
  const cap = capK * 1000;

  const [price, setPrice] = useState(entryPrices[0] || watchlist.ltp || 0);
  const [qty, setQty] = useState(0);
  const [preview, setPreview] = useState<BuyState | null>(null);
  const [loading, setLoading] = useState(false);

  const [split, setSplit] = useState<number[]>(() =>
    defaultSplit(entryPrices.length),
  );

  useEffect(() => {
    setQty(maxQtyInsideCap(price, cap));
  }, [price, cap]);

  const previewTimer = useRef<any>(null);

  useEffect(() => {
    clearTimeout(previewTimer.current);
    if (qty <= 0 || price <= 0) {
      setPreview(null);
      return;
    }
    previewTimer.current = setTimeout(runPreview, 350);
  }, [qty, price]);

  async function runPreview() {
    setLoading(true);
    try {
      const res = await apiPost<any>("stocks/trades/preview", {
        symbol,
        type: "buy",
        qty,
        price,
      });
      setPreview(parseBuyPreview(res?.data || res, position));
    } finally {
      setLoading(false);
    }
  }

  function handleSliderChange(idx: number, val: number) {
    setSplit((prev) => computeNewSplit(prev, idx, val));
  }

  return (
    <div className="flex flex-col gap-5">
      <NumInput
        label={
          position
            ? leftoverK <= 0
              ? "Target Capital (No leftover)"
              : "Target Capital"
            : "Target Capital"
        }
        value={capK}
        onChange={setCapK}
        min={0}
        step={1}
        prefix="Rs"
      />

      {entryPrices.length >= 2 && (
        <SplitSlider
          symbol={symbol}
          entryPrices={entryPrices}
          split={split}
          cap={cap}
          onChange={handleSliderChange}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumInput
          label="Buy Price"
          value={price}
          onChange={setPrice}
          min={1}
          step={1}
          prefix="Rs"
        />
        <NumInput
          label="Quantity"
          value={qty}
          onChange={setQty}
          min={1}
          step={1}
        />
      </div>

      {loading && (
        <div className="text-xs text-faint flex gap-2 items-center">
          <RefreshCw size={12} className="animate-spin" />
          Calculating...
        </div>
      )}

      {preview && (
        <div className="bg-elevated rounded-xl px-3 py-2 flex flex-col">
          <Row label="Quantity" value={String(preview.qty)} />
          <Row label="Total Cost" value={`Rs ${fmt(preview.totalCost)}`} bold />
          <Row
            label="Commission"
            value={`Rs ${fmt(preview.commission)}`}
            separator
            color="text-warning"
          />
          <Row
            label="New WACC"
            value={`Rs ${fmt(preview.newWacc)}`}
            bold
            separator
            sub={position ? `was Rs ${fmt(position.avgBuy)}` : undefined}
          />
          {position && (
            <Row
              label="Portfolio Qty"
              value={String((position.qty || 0) + preview.qty)}
            />
          )}
          <Row
            label="Cap Left"
            value={`Rs ${fmt(Math.max(0, cap - preview.totalCost))}`}
          />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────── */
/* SELL */
/* ───────────────────────────────────────────── */

function SellSection({
  symbol,
  position,
}: {
  symbol: string;
  position: Position;
}) {
  const [price, setPrice] = useState(position.ltp || 0);
  const [qty, setQty] = useState(position.qty || 0);
  const [preview, setPreview] = useState<SellState | null>(null);
  const [err, setErr] = useState("");

  const timer = useRef<any>(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (qty > position.qty) {
      setErr("Qty exceeds holding");
      return;
    }
    setErr("");
    timer.current = setTimeout(runPreview, 350);
  }, [price, qty]);

  async function runPreview() {
    const res = await apiPost<any>("stocks/trades/preview", {
      symbol,
      type: "sell",
      qty,
      price,
    });
    setPreview(parseSellPreview(res?.data || res));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-elevated rounded-xl px-3 py-2 text-xs font-mono">
        Holding {position.qty} @ Rs {fmt(position.avgBuy)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumInput
          label="Sell Price"
          value={price}
          onChange={setPrice}
          min={1}
          step={1}
          prefix="Rs"
        />
        <NumInput
          label="Quantity"
          value={qty}
          onChange={setQty}
          min={1}
          step={1}
        />
      </div>
      {err && <div className="text-danger text-xs">{err}</div>}
      {preview && !err && (
        <div className="bg-elevated rounded-xl px-3 py-2 flex flex-col">
          <Row label="Quantity" value={String(preview.qty)} />
          <Row
            label="Net Received"
            value={`Rs ${fmt(preview.totalSell)}`}
            bold
          />
          <Row label="Fees" value={`Rs ${fmt(preview.commission)}`} separator />
          <Row label="CGT" value={`Rs ${fmt(preview.cgt)}`} />
          <Row
            label="Net P&L"
            value={`Rs ${fmt(preview.netPl)}`}
            bold
            separator
            color={preview.netPl >= 0 ? "text-positive" : "text-danger"}
          />
          <Row label="Qty Left" value={String(position.qty - qty)} />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────── */
/* MAIN */
/* ───────────────────────────────────────────── */

export function StockSimulator({ symbol, watchlist, position }: Props) {
  const [mode, setMode] = useState<Mode>(position ? "sell" : "buy");
  const parsedSlTp = parseSlTp(watchlist.slTp);

  return (
    <div className="bg-surface rounded-2xl overflow-hidden max-w-2xl">
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={13} />
            <span className="text-[10px] uppercase tracking-widest text-muted">
              Simulator
            </span>
          </div>
          <span className="text-[10px] text-faint">read only</span>
        </div>

        <div className="flex bg-elevated rounded-xl p-1 gap-1">
          <ModeTab
            active={mode === "buy"}
            onClick={() => setMode("buy")}
            icon={<ShoppingCart size={12} />}
            label="Buy"
          />
          {position && (
            <ModeTab
              active={mode === "sell"}
              onClick={() => setMode("sell")}
              icon={<TrendingDown size={12} />}
              label="Sell"
            />
          )}
        </div>

        <div className="text-[10px] font-mono text-faint flex flex-wrap gap-3">
          <span>LTP {watchlist.ltp}</span>
          {watchlist.targetCap > 0 && (
            <span>
              TCap Rs {fmtInt(Math.floor((watchlist.targetCap * 1000) / 1000))}k
            </span>
          )}
          {parsedSlTp && (
            <>
              <span>SL {parsedSlTp.sl}</span>
              <span>TP {parsedSlTp.tp}</span>
            </>
          )}
        </div>
      </div>

      <div className="h-px bg-border mx-5" />

      <div className="px-5 py-4">
        {mode === "buy" ? (
          <BuySection
            symbol={symbol}
            watchlist={watchlist}
            position={position}
          />
        ) : position ? (
          <SellSection symbol={symbol} position={position} />
        ) : null}
      </div>
    </div>
  );
}

function ModeTab({
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
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition ${
        active ? "bg-surface text-fg" : "text-faint hover:text-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
