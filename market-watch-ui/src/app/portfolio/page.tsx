"use client";

import { useState, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost } from "@/lib/api";
import { useAppStore } from "@/store/app";
import type { Position, CapitalSummary, CapitalEntry } from "@/lib/types";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  PlusCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Wallet,
  PieChart as PieIcon,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { useQueryTab } from "@/hooks/useQueryTab";

// ─── Sort config ─────────────────────────────────────────────
type SortField =
  | "symbol"
  | "qty"
  | "avgBuy"
  | "ltp"
  | "invested"
  | "currentVal"
  | "netPL"
  | "plPct"
  | "chgPct";
type SortDir = "asc" | "desc";

// ─── Tab type ────────────────────────────────────────────────
type Tab = "positions" | "capital";

const tt = {
  background: "var(--color-elevated)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  color: "var(--color-fg)",
  fontSize: "11px",
};

// ─────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  return (
    <Suspense>
      <PortfolioPageInner />
    </Suspense>
  );
}

function PortfolioPageInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const prices = useAppStore((s) => s.prices);
  const storePositions = useAppStore((s) => s.positions);
  const [tab, setTab] = useQueryTab<Tab>(["positions", "capital"], "positions");

  // ── Positions ────────────────────────────────────────────────
  const { data: positions, isLoading: posLoading } = useQuery<Position[]>({
    queryKey: ["positions"],
    queryFn: async () => {
      const raw = await apiFetch<unknown>("stocks/positions");
      if (Array.isArray(raw)) return raw as Position[];
      if (raw && typeof raw === "object") {
        const o = raw as Record<string, unknown>;
        if (Array.isArray(o.positions)) return o.positions as Position[];
        return Object.values(o) as Position[];
      }
      return [];
    },
    refetchInterval: 60_000,
    placeholderData: [],
  });

  // ── Capital ──────────────────────────────────────────────────
  const { data: capital, isLoading: capLoading } = useQuery<CapitalSummary>({
    queryKey: ["capital"],
    queryFn: () => apiFetch<CapitalSummary>("stocks/capital"),
    refetchInterval: 120_000,
  });

  // ── Live-enriched positions ───────────────────────────────────
  const enriched = useMemo(() => {
    const basePositions = storePositions ?? positions ?? [];

    return basePositions.map((p) => {
      const live = prices[p.symbol];

      return {
        ...p,

        // only UI-updated fields
        ltp: live?.ltp ?? p.ltp,
        chgPct: live?.percentChange ?? p.chgPct,

        // backend is source of truth (DO NOT TOUCH)
        currentVal: p.currentVal,
        netPL: p.netPL,
        plPct: p.plPct,
      };
    });
  }, [storePositions, positions, prices]);

  const totalInvested = enriched.reduce((s, p) => s + p.invested, 0);
  const totalCurrentVal = enriched.reduce((s, p) => s + p.currentVal, 0);
  const totalPL = enriched.reduce((s, p) => s + p.netPL, 0);
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 pb-10 max-w-screen-2xl mx-auto w-full">
      {/* ── Tab switcher ───────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-2xl p-1 w-fit">
        {(["positions", "capital"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-medium capitalize transition-all cursor-pointer ${
              tab === t
                ? "bg-primary text-bg shadow-sm"
                : "text-muted hover:text-fg hover:bg-elevated"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "positions" ? (
        <PositionsSection
          enriched={enriched}
          loading={posLoading}
          totalInvested={totalInvested}
          totalCurrentVal={totalCurrentVal}
          totalPL={totalPL}
          totalPLPct={totalPLPct}
          capital={capital}
          onSymbolClick={(sym) => router.push(`/stocks/${sym}`)}
        />
      ) : (
        <CapitalSection
          capital={capital}
          loading={capLoading}
          qc={qc}
          positions={positions ?? []}
        />
      )}
    </div>
  );
}

function PositionBreakdownBar({
  capital,
  position,
}: {
  capital: CapitalSummary;
  position: Position[];
}) {
  const max = capital?.maxPerStock ?? 0;

  const enriched = (position ?? []).map((p) => {
    const ltpValue = p.qty * p.ltp;
    const investedValue = p.invested;

    const allowedQty = max ? Math.floor(max / p.ltp) : p.qty;
    const reduceQty = Math.max(0, p.qty - allowedQty);

    const investedAllowedQty = max
      ? Math.floor(max / (p.avgBuy || p.ltp))
      : p.qty;

    const reduceQtyInvested = Math.max(0, p.qty - investedAllowedQty);

    return {
      ...p,
      ltpValue,
      investedValue,
      allowedQty,
      reduceQty,
      investedAllowedQty,
      reduceQtyInvested,
      isRisk: max ? ltpValue > max : false,
      overLtp: max ? ltpValue - max : 0,
      overInvested: max ? investedValue - max : 0,
    };
  });

  const risky = enriched
    .filter((p) => p.isRisk)
    .sort((a, b) => b.overLtp - a.overLtp);

  const safe = enriched.filter((p) => !p.isRisk);

  if (!max) {
    return <div className="text-xs text-faint">Max per stock not set</div>;
  }

  return (
    <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
      {/* ================= RISK STOCKS ================= */}
      {risky.map((p) => (
        <div
          key={p.symbol}
          className="p-3 rounded-xl border border-danger/20 bg-danger/5 flex flex-col gap-2"
        >
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-mono font-bold">{p.symbol}</p>

              {/* PRIMARY: MARKET OVER */}
              <p className="text-[10px] text-faint">
                Market Over:{" "}
                <span className="text-danger">{formatCurrency(p.overLtp)}</span>
                <span className="text-muted ml-1">/ reduce {p.reduceQty}</span>
              </p>

              {/* SECONDARY: INVESTED OVER (with reduce qty) */}
              <p className="text-[10px] text-muted">
                Invested Over: {formatCurrency(p.overInvested)}
                <span className="ml-1">/ reduce {p.reduceQtyInvested}</span>
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs">Reduce {p.reduceQty}</p>
              <p className="text-[10px] text-muted">safe qty {p.allowedQty}</p>
            </div>
          </div>

          {/* breakdown grid */}
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="bg-elevated rounded-lg p-2">
              <p className="text-faint">Qty</p>
              <p className="font-mono">{p.qty}</p>
            </div>

            <div className="bg-elevated rounded-lg p-2">
              <p className="text-faint">Allowed</p>
              <p className="font-mono">{p.allowedQty}</p>
            </div>

            <div className="bg-elevated rounded-lg p-2">
              <p className="text-faint">LTP</p>
              <p className="font-mono">{p.ltp.toFixed(2)}</p>
            </div>
          </div>

          {/* exposure bar */}
          <div className="w-full h-2 bg-zinc-800/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500"
              style={{
                width: `${Math.min(100, (p.ltpValue / max) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}

      {/* ================= SAFE STOCKS ================= */}
      {safe.map((p) => (
        <div
          key={p.symbol}
          className="p-3 rounded-xl border border-border bg-surface flex flex-col gap-1"
        >
          <div className="flex justify-between">
            <p className="text-sm font-mono font-bold">{p.symbol}</p>
            <p className="text-[10px] text-faint">{p.qty} qty</p>
          </div>

          <div className="flex justify-between text-[10px] text-faint">
            <span>Invested: {formatCurrency(p.investedValue)}</span>
            <span>LTP: {p.ltp.toFixed(2)}</span>
          </div>

          <div className="w-full h-1 bg-zinc-800/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-500"
              style={{
                width: `${Math.min(100, (p.ltpValue / max) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CapitalBreakdownBar({ capital }: { capital: CapitalSummary }) {
  const trading = Math.max(0, capital.tradingCapital || 0);
  const reserved = Math.max(0, capital.reservedCapital || 0);
  const deployed = Math.max(0, capital.deployedCapital || 0);

  const total = trading + reserved;

  // ----------------------------
  // CORE SPLIT (Zerodha logic)
  // ----------------------------
  const tradingUsed = Math.min(deployed, trading);
  const reserveUsed = Math.max(0, deployed - trading);

  const tradingPct = trading > 0 ? (tradingUsed / trading) * 100 : 0;
  const reservePct = reserved > 0 ? (reserveUsed / reserved) * 100 : 0;

  const usedPct = total > 0 ? (deployed / total) * 100 : 0;

  const reserveActive = reserveUsed > 0;
  const isOver = deployed > total;

  return (
    <div className="flex flex-col gap-6">
      {/* ================= TOP (Zerodha Margin Strip) ================= */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[11px] text-muted">
          <span>Total Margin: {formatCurrency(total)}</span>
          <span>Used: {formatCurrency(deployed)}</span>
        </div>

        <div className="relative w-full h-10 rounded-xl bg-zinc-900/40 border border-border overflow-hidden">
          {/* background grid feel */}
          <div className="absolute inset-0 bg-white/5" />

          {/* Trading fill (primary) */}
          <div
            className="absolute left-0 top-0 h-full bg-blue-500 transition-all"
            style={{ width: `${Math.min(100, (tradingUsed / total) * 100)}%` }}
          />

          {/* Reserve spillover */}
          <div
            className="absolute left-0 top-0 h-full bg-yellow-500 transition-all"
            style={{
              width: `${Math.min(
                100,
                ((tradingUsed + reserveUsed) / total) * 100,
              )}%`,
              opacity: 0.85,
            }}
          />

          {/* center label */}
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-mono text-white/80">
            {usedPct.toFixed(1)}% Used
          </div>

          {/* overflow marker */}
          {isOver && (
            <div className="absolute right-0 top-0 w-1 h-full bg-red-500 animate-pulse" />
          )}
        </div>

        {isOver && (
          <div className="text-[11px] text-red-400">⚠ Margin exceeded</div>
        )}
      </div>

      {/* ================= BOTTOM (Zerodha-style breakdown cards) ================= */}
      <div className="grid grid-cols-2 gap-4">
        {/* TRADING MARGIN */}
        <div className="p-3 rounded-xl bg-zinc-900/30 border border-border/50">
          <div className="text-[11px] font-semibold mb-2">Trading Margin</div>

          <div className="w-full h-24 bg-zinc-800/40 rounded-lg relative overflow-hidden">
            <div
              className="absolute bottom-0 w-full bg-blue-500 transition-all"
              style={{ height: `${tradingPct}%` }}
            />

            <div className="absolute inset-0 flex items-end justify-center pb-1">
              <span className="text-[10px] text-white/80">
                {tradingPct.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="text-[11px] mt-2 text-muted font-mono">
            {formatCurrency(trading - tradingUsed)} / {formatCurrency(trading)}
          </div>
        </div>

        {/* RESERVED MARGIN */}
        <div className="p-3 rounded-xl bg-zinc-900/30 border border-border/50">
          <div className="text-[11px] font-semibold mb-2">Reserved Margin</div>

          <div className="w-full h-24 bg-zinc-800/40 rounded-lg relative overflow-hidden">
            <div
              className="absolute bottom-0 w-full bg-yellow-500 transition-all"
              style={{ height: `${reservePct}%` }}
            />

            <div className="absolute inset-0 flex items-end justify-center pb-1">
              <span className="text-[10px] text-white/80">
                {reserveActive ? reservePct.toFixed(0) : "0"}%
              </span>
            </div>
          </div>

          <div className="text-[11px] mt-2 text-muted font-mono">
            {formatCurrency(reserved - reserveUsed)} /{" "}
            {formatCurrency(reserved)}
          </div>

          {reserveActive && (
            <div className="text-[10px] text-yellow-400 mt-1">
              ⚠ Using reserve buffer
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  POSITIONS SECTION
// ─────────────────────────────────────────────────────────────
type EnrichedPosition = Position & {
  currentVal: number;
  netPL: number;
  plPct: number;
};

function PositionsSection({
  enriched,
  loading,
  totalInvested,
  totalCurrentVal,
  totalPL,
  totalPLPct,
  capital,
  onSymbolClick,
}: {
  enriched: EnrichedPosition[];
  loading: boolean;
  totalInvested: number;
  totalCurrentVal: number;
  totalPL: number;
  totalPLPct: number;
  capital: CapitalSummary | undefined;
  onSymbolClick: (sym: string) => void;
}) {
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "currentVal",
    dir: "desc",
  });
  const [selectedSym, setSelectedSym] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      const av = a[sort.field] as number | string;
      const bv = b[sort.field] as number | string;
      const cmp =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : (av as number) - (bv as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [enriched, sort]);

  const selected = enriched.find((p) => p.symbol === selectedSym) ?? null;

  function toggleSort(field: SortField) {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "desc" },
    );
  }

  // Pie data
  const pieData = enriched
    .filter((p) => p.currentVal > 0)
    .map((p) => ({ name: p.symbol, value: p.currentVal }))
    .sort((a, b) => b.value - a.value);

  const PIE_COLORS = [
    "var(--color-primary)",
    "var(--color-secondary)",
    "var(--color-positive)",
    "var(--color-warning)",
    "var(--color-primary-dim)",
    "var(--color-secondary-dim)",
    "var(--color-danger)",
    "var(--color-faint)",
  ];

  // Waterfall-style bar data: per-symbol P&L
  const plBarData = [...enriched]
    .sort((a, b) => b.netPL - a.netPL)
    .map((p) => ({ symbol: p.symbol, pl: p.netPL, pct: p.plPct }));

  const deployedPct =
    capital && capital.tradingCapital > 0
      ? (totalInvested / capital.tradingCapital) * 100
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Summary cards ──────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniCard
          label="Total Invested"
          icon={<DollarSign size={13} />}
          accent="primary"
          loading={loading}
        >
          <p className="text-base font-mono font-semibold text-fg">
            {formatCurrency(totalInvested)}
          </p>
          {deployedPct !== null && (
            <p className="text-[10px] text-faint">
              {deployedPct.toFixed(1)}% of trading capital deployed
            </p>
          )}
        </MiniCard>

        <MiniCard
          label="Current Value"
          icon={<BarChart3 size={13} />}
          accent="secondary"
          loading={loading}
        >
          <p className="text-base font-mono font-semibold text-fg">
            {formatCurrency(totalCurrentVal)}
          </p>
          <p className="text-[10px] text-faint">
            {enriched.length} open positions
          </p>
        </MiniCard>

        <MiniCard
          label="Unrealized P&L"
          icon={
            totalPL >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />
          }
          accent={totalPL >= 0 ? "positive" : "danger"}
          loading={loading}
        >
          <p
            className={`text-base font-mono font-semibold ${totalPL >= 0 ? "text-positive" : "text-danger"}`}
          >
            {totalPL >= 0 ? "+" : ""}
            {formatCurrency(totalPL)}
          </p>
          <p
            className={`text-[10px] font-mono ${totalPLPct >= 0 ? "text-positive" : "text-danger"}`}
          >
            {formatPercent(totalPLPct)}
          </p>
        </MiniCard>

        <MiniCard
          label="Avg Day Change"
          icon={<RefreshCw size={13} />}
          accent="warning"
          loading={loading}
        >
          {(() => {
            const prices_ = enriched.map((p) => p.chgPct);
            const avg =
              prices_.length > 0
                ? prices_.reduce((a, b) => a + b, 0) / prices_.length
                : 0;
            return (
              <>
                <p
                  className={`text-base font-mono font-semibold ${avg >= 0 ? "text-positive" : "text-danger"}`}
                >
                  {formatPercent(avg)}
                </p>
                <p className="text-[10px] text-faint">
                  average across positions
                </p>
              </>
            );
          })()}
        </MiniCard>
      </section>

      {/* ── Charts row ─────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Allocation pie */}
        <Card className="flex flex-col gap-3">
          <SectionHeader title="Allocation" icon={<PieIcon size={13} />} />
          {loading ? (
            <Skeleton h="h-44" />
          ) : pieData.length === 0 ? (
            <Empty msg="No positions" />
          ) : (
            <div className="flex gap-3 items-center">
              <div className="w-32 h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={56}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: unknown) =>
                        [formatCurrency(Number(v)), ""] as [string, string]
                      }
                      contentStyle={tt}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex flex-col gap-1 flex-1 min-w-0">
                {pieData.slice(0, 6).map((e, i) => {
                  const pct =
                    totalCurrentVal > 0 ? (e.value / totalCurrentVal) * 100 : 0;
                  return (
                    <li
                      key={e.name}
                      className="flex items-center gap-2 cursor-pointer group"
                      onClick={() => onSymbolClick(e.name)}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      <span className="text-xs font-mono text-fg group-hover:text-primary transition truncate flex-1">
                        {e.name}
                      </span>
                      <span className="text-[10px] text-muted shrink-0">
                        {pct.toFixed(1)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>

        {/* P&L per stock bar */}
        <Card className="lg:col-span-2 flex flex-col gap-3">
          <SectionHeader
            title="Unrealized P&L per Stock"
            icon={<Layers size={13} />}
          />
          {loading ? (
            <Skeleton h="h-44" />
          ) : plBarData.length === 0 ? (
            <Empty msg="No data" />
          ) : (
            <div style={{ height: 152 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={plBarData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="symbol"
                    tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    width={34}
                  />
                  <Tooltip
                    formatter={(v: unknown, name: unknown) => [
                      name === "pl"
                        ? formatCurrency(Number(v))
                        : formatPercent(Number(v)),
                      name === "pl" ? "P&L" : "P&L %",
                    ]}
                    contentStyle={tt}
                  />
                  <Bar
                    dataKey="pl"
                    radius={[3, 3, 0, 0]}
                    onClick={(d: any) => {
                      onSymbolClick(d.symbol);
                      setSelectedSym(d.symbol);
                    }}
                  >
                    {plBarData.map((e, i) => (
                      <Cell
                        key={i}
                        fill={
                          e.pl >= 0
                            ? "var(--color-positive)"
                            : "var(--color-danger)"
                        }
                        fillOpacity={0.82}
                        cursor="pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </section>

      {/* ── Positions Table + mini detail ─────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Table — 2 cols on xl */}
        <Card className="xl:col-span-2 flex flex-col gap-3 overflow-hidden">
          <SectionHeader
            title="Positions"
            icon={<Layers size={13} />}
            sub={`${enriched.length} stocks`}
          />
          {loading ? (
            <Skeleton h="h-52" />
          ) : enriched.length === 0 ? (
            <Empty msg="No open positions" />
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="border-b border-border">
                    {(
                      [
                        { field: "symbol", label: "Symbol" },
                        { field: "qty", label: "Qty" },
                        { field: "avgBuy", label: "Avg Buy" },
                        { field: "ltp", label: "LTP" },
                        { field: "chgPct", label: "Day %" },
                        { field: "invested", label: "Invested" },
                        { field: "currentVal", label: "Cur. Val" },
                        { field: "netPL", label: "P&L" },
                        { field: "plPct", label: "P&L %" },
                      ] as { field: SortField; label: string }[]
                    ).map((col) => (
                      <th
                        key={col.field}
                        className="text-left text-[10px] text-faint font-medium py-2 pr-3 whitespace-nowrap cursor-pointer select-none hover:text-fg transition"
                        onClick={() => toggleSort(col.field)}
                      >
                        <span className="flex items-center gap-0.5">
                          {col.label}
                          {sort.field === col.field ? (
                            sort.dir === "asc" ? (
                              <ArrowUp size={9} className="text-primary" />
                            ) : (
                              <ArrowDown size={9} className="text-primary" />
                            )
                          ) : (
                            <ArrowUpDown size={9} className="opacity-30" />
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="text-left text-[10px] text-faint font-medium py-2 pr-3">
                      →
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((pos) => {
                    const isUp = pos.netPL >= 0;
                    const dayUp = pos.chgPct >= 0;
                    const isSelected = selectedSym === pos.symbol;
                    return (
                      <tr
                        key={pos.symbol}
                        onClick={() =>
                          setSelectedSym(isSelected ? null : pos.symbol)
                        }
                        className={`border-b border-border/40 cursor-pointer transition-colors ${isSelected ? "bg-primary/8" : "hover:bg-elevated/50"}`}
                      >
                        <td className="py-2.5 pr-3 font-mono font-bold text-fg">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSymbolClick(pos.symbol);
                            }}
                            className="font-mono font-bold text-fg hover:text-primary transition cursor-pointer"
                          >
                            {pos.symbol}
                          </button>
                        </td>
                        <td className="py-2.5 pr-3 text-muted font-mono">
                          {pos.qty}
                        </td>
                        <td className="py-2.5 pr-3 text-muted font-mono">
                          {pos.avgBuy.toFixed(2)}
                        </td>
                        <td className="py-2.5 pr-3 font-mono font-semibold text-fg">
                          {pos.ltp.toFixed(2)}
                        </td>
                        <td
                          className={`py-2.5 pr-3 font-mono font-semibold ${dayUp ? "text-positive" : "text-danger"}`}
                        >
                          {dayUp ? "+" : ""}
                          {pos.chgPct.toFixed(2)}%
                        </td>
                        <td className="py-2.5 pr-3 text-muted font-mono">
                          {formatCurrency(pos.invested)}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-fg">
                          {formatCurrency(pos.currentVal)}
                        </td>
                        <td
                          className={`py-2.5 pr-3 font-mono font-semibold ${isUp ? "text-positive" : "text-danger"}`}
                        >
                          {isUp ? "+" : ""}
                          {formatCurrency(pos.netPL)}
                        </td>
                        <td
                          className={`py-2.5 pr-3 font-mono font-semibold ${isUp ? "text-positive" : "text-danger"}`}
                        >
                          <span className="flex items-center gap-0.5">
                            {isUp ? (
                              <ArrowUpRight size={10} />
                            ) : (
                              <ArrowDownRight size={10} />
                            )}
                            {Math.abs(pos.plPct).toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5">
                          <ChevronRight size={12} className="text-faint" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Mini detail panel */}
        <Card className="flex flex-col gap-3">
          {selected ? (
            <StockMiniDetail
              pos={selected}
              onNavigate={() => onSymbolClick(selected.symbol)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <Layers size={22} className="text-faint" />
              <p className="text-xs text-faint">Click a row to see details</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Mini detail card for selected position ─────────────────────
function StockMiniDetail({
  pos,
  onNavigate,
}: {
  pos: EnrichedPosition;
  onNavigate: () => void;
}) {
  const isUp = pos.netPL >= 0;
  const dayUp = pos.chgPct >= 0;

  // Simple sparkline-style area chart: simulate intra-position range from high/low/ltp
  const rangeData = [
    { label: "Low", val: pos.low },
    { label: "Avg", val: pos.avgBuy },
    { label: "LTP", val: pos.ltp },
    { label: "High", val: pos.high },
  ];

  const rows = [
    { label: "Qty", value: String(pos.qty) },
    { label: "Avg Buy", value: pos.avgBuy.toFixed(2) },
    { label: "LTP", value: pos.ltp.toFixed(2) },
    { label: "Invested", value: formatCurrency(pos.invested) },
    { label: "Cur. Value", value: formatCurrency(pos.currentVal) },
    {
      label: "Day Change",
      value: `${dayUp ? "+" : ""}${pos.chgPct.toFixed(2)}%`,
      color: dayUp ? "text-positive" : "text-danger",
    },
    { label: "High", value: pos.high.toFixed(2) },
    { label: "Low", value: pos.low.toFixed(2) },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold font-mono text-fg">{pos.symbol}</h3>
          <p className="text-[10px] text-faint">Position Detail</p>
        </div>
        <button
          onClick={onNavigate}
          className="flex items-center gap-1 text-[10px] text-primary hover:text-primary-strong transition cursor-pointer bg-primary/10 px-2.5 py-1 rounded-full"
        >
          Full View <ArrowUpRight size={10} />
        </button>
      </div>

      {/* P&L highlight */}
      <div
        className={`p-3 rounded-xl border ${isUp ? "border-positive/20 bg-positive/8" : "border-danger/20 bg-danger/8"}`}
      >
        <p className="text-[10px] text-faint mb-0.5">Unrealized P&L</p>
        <p
          className={`text-xl font-mono font-bold ${isUp ? "text-positive" : "text-danger"}`}
        >
          {isUp ? "+" : ""}
          {formatCurrency(pos.netPL)}
        </p>
        <p
          className={`text-xs font-mono ${isUp ? "text-positive" : "text-danger"}`}
        >
          {formatPercent(pos.plPct)}
        </p>
      </div>

      {/* Range chart */}
      <div>
        <p className="text-[10px] text-faint mb-1">Price Range (Low → High)</p>
        <div style={{ height: 60 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={rangeData}
              margin={{ top: 2, right: 4, left: 4, bottom: 0 }}
            >
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="val"
                stroke="var(--color-primary)"
                strokeWidth={1.5}
                fill="url(#rg)"
                dot={{ r: 3, fill: "var(--color-primary)", strokeWidth: 0 }}
              />
              <Tooltip
                formatter={(v: unknown) => [Number(v).toFixed(2), ""]}
                contentStyle={{ ...tt, fontSize: 10 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="bg-elevated rounded-lg px-2.5 py-2 flex flex-col gap-0.5"
          >
            <span className="text-[9px] text-faint uppercase tracking-wide">
              {r.label}
            </span>
            <span
              className={`text-xs font-mono font-semibold ${r.color ?? "text-fg"}`}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  CAPITAL SECTION
// ─────────────────────────────────────────────────────────────
function CapitalSection({
  capital,
  loading,
  qc,
  positions,
}: {
  capital: CapitalSummary | undefined;
  loading: boolean;
  qc: ReturnType<typeof useQueryClient>;
  positions: Position[];
}) {
  const [addForm, setAddForm] = useState({
    date: today(),
    amount: "",
    notes: "",
  });
  const [retainForm, setRetainForm] = useState({
    date: today(),
    amount: "",
    notes: "",
  });
  const [addMsg, setAddMsg] = useState("");
  const [retainMsg, setRetainMsg] = useState("");

  const addMut = useMutation({
    mutationFn: (body: { date: string; amount: number; notes: string }) =>
      apiPost("stocks/capital/add", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["capital"] });
      setAddForm({ date: today(), amount: "", notes: "" });
      setAddMsg("Capital added ✓");
      setTimeout(() => setAddMsg(""), 3000);
    },
  });

  const retainMut = useMutation({
    mutationFn: (body: { date: string; amount: number; notes: string }) =>
      apiPost("stocks/capital/retain", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["capital"] });
      setRetainForm({ date: today(), amount: "", notes: "" });
      setRetainMsg("Retention recorded ✓");
      setTimeout(() => setRetainMsg(""), 3000);
    },
  });

  // Chart: additions over time (cumulative)
  const additionsCum = useMemo(() => {
    if (!capital) return [];
    let running = 0;
    return [...(capital.additions ?? [])]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => {
        running += e.amount;
        return { date: e.date.slice(0, 10), total: running, amount: e.amount };
      });
  }, [capital]);

  // Monthly retentions bar
  const retentionsByMonth = useMemo(() => {
    if (!capital) return [];
    const map: Record<string, number> = {};
    for (const e of capital.retentions ?? []) {
      const key = e.date.slice(0, 7);
      map[key] = (map[key] ?? 0) + e.amount;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, v]) => ({ month: m.slice(2), value: v }));
  }, [capital]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Capital stat cards ─────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Total Capital Added",
            value: capital?.totalCapitalAdded,
            accent: "primary" as const,
            icon: <PlusCircle size={13} />,
          },
          {
            label: "Trading Capital",
            value: capital?.tradingCapital,
            accent: "secondary" as const,
            icon: <Wallet size={13} />,
          },
          {
            label: "Available Capital",
            value: capital?.availableCapital,
            accent: "positive" as const,
            icon: <DollarSign size={13} />,
          },
          {
            label: "Deployed Capital",
            value: capital?.deployedCapital,
            accent: "warning" as const,
            icon: <BarChart3 size={13} />,
          },
        ].map((c) => (
          <MiniCard
            key={c.label}
            label={c.label}
            icon={c.icon}
            accent={c.accent}
            loading={loading}
          >
            {loading || c.value === undefined ? (
              <Skeleton h="h-5" w="w-24" />
            ) : (
              <p className="text-base font-mono font-semibold text-fg">
                {formatCurrency(c.value)}
              </p>
            )}
          </MiniCard>
        ))}
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Total Retained",
            value: capital?.totalRetained,
            accent: "primary" as const,
          },
          {
            label: "Realized P&L",
            value: capital?.realizedPL,
            accent:
              capital?.realizedPL && capital.realizedPL >= 0
                ? ("positive" as const)
                : ("danger" as const),
          },
          {
            label: "Reserved Capital",
            value: capital?.reservedCapital,
            accent: "warning" as const,
          },
          {
            label: "Max Per Stock",
            value: capital?.maxPerStock,
            accent: "secondary" as const,
          },
        ].map((c) => (
          <MiniCard
            key={c.label}
            label={c.label}
            icon={<DollarSign size={13} />}
            accent={c.accent}
            loading={loading}
          >
            {loading || c.value === undefined ? (
              <Skeleton h="h-5" w="w-24" />
            ) : (
              <p
                className={`text-base font-mono font-semibold ${c.accent === "positive" ? "text-positive" : c.accent === "danger" ? "text-danger" : "text-fg"}`}
              >
                {formatCurrency(c.value)}
              </p>
            )}
          </MiniCard>
        ))}
      </section>

      {/* ── Charts ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Cumulative capital added */}
        <Card className="flex flex-col gap-3">
          <SectionHeader
            title="Cumulative Capital Added"
            icon={<TrendingUp size={13} />}
          />
          {loading ? (
            <Skeleton h="h-44" />
          ) : additionsCum.length === 0 ? (
            <Empty msg="No capital additions yet" />
          ) : (
            <div style={{ height: 152 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={additionsCum}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    width={34}
                  />
                  <Tooltip
                    formatter={(v: unknown, name: unknown) => [
                      formatCurrency(Number(v)),
                      name === "total" ? "Cumulative" : "Added",
                    ]}
                    contentStyle={tt}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#capGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--color-primary)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        {/* Capital breakdown donut */}
        <Card className="flex flex-col gap-3">
          <SectionHeader
            title="Capital Breakdown"
            icon={<BarChart3 size={13} />}
          />
          {loading ? (
            <Skeleton h="h-44" />
          ) : !capital ? (
            <Empty msg="No capital data" />
          ) : (
            <CapitalBreakdownBar capital={capital} />
          )}
        </Card>
        {/* Capital breakdown donut */}
        <Card className="flex flex-col gap-3">
          <SectionHeader
            title="Position Breakdown"
            icon={<BarChart3 size={13} />}
          />
          {loading ? (
            <Skeleton h="h-44" />
          ) : !capital ? (
            <Empty msg="No Position data" />
          ) : (
            <PositionBreakdownBar capital={capital} position={positions} />
          )}
        </Card>
      </section>

      {/* Retentions bar */}
      {retentionsByMonth.length > 0 && (
        <Card className="flex flex-col gap-3">
          <SectionHeader
            title="Monthly Retentions"
            icon={<BarChart3 size={13} />}
          />
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={retentionsByMonth}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={34}
                />
                <Tooltip
                  formatter={(v: unknown) => [
                    formatCurrency(Number(v)),
                    "Retained",
                  ]}
                  contentStyle={tt}
                />
                <Bar
                  dataKey="value"
                  fill="var(--color-secondary)"
                  fillOpacity={0.78}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ── Input forms + history tables ───────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Add capital */}
        <Card className="flex flex-col gap-4">
          <SectionHeader title="Add Capital" icon={<PlusCircle size={13} />} />
          <div className="flex flex-col gap-2.5">
            <FieldRow label="Date">
              <input
                type="date"
                value={addForm.date}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, date: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="Amount">
              <input
                type="number"
                placeholder="e.g. 50000"
                value={addForm.amount}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, amount: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="Notes">
              <input
                type="text"
                placeholder="Optional note"
                value={addForm.notes}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, notes: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
            <button
              onClick={() => {
                const amt = parseFloat(addForm.amount);
                if (!amt || isNaN(amt)) return;
                addMut.mutate({
                  date: addForm.date,
                  amount: amt,
                  notes: addForm.notes,
                });
              }}
              disabled={addMut.isPending || !addForm.amount}
              className="self-end px-4 py-2 text-xs bg-primary text-bg rounded-full hover:bg-primary-strong transition font-semibold cursor-pointer disabled:opacity-40"
            >
              {addMut.isPending ? "Saving…" : "Add Capital"}
            </button>
            {addMsg && <p className="text-xs text-positive">{addMsg}</p>}
          </div>
          <HistoryTable
            entries={capital?.additions ?? []}
            label="Capital Additions"
            loading={loading}
          />
        </Card>

        {/* Retain capital */}
        <Card className="flex flex-col gap-4">
          <SectionHeader title="Retain Profit" icon={<Wallet size={13} />} />
          <div className="flex flex-col gap-2.5">
            <FieldRow label="Date">
              <input
                type="date"
                value={retainForm.date}
                onChange={(e) =>
                  setRetainForm((f) => ({ ...f, date: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="Amount">
              <input
                type="number"
                placeholder="e.g. 10000"
                value={retainForm.amount}
                onChange={(e) =>
                  setRetainForm((f) => ({ ...f, amount: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="Notes">
              <input
                type="text"
                placeholder="Optional note"
                value={retainForm.notes}
                onChange={(e) =>
                  setRetainForm((f) => ({ ...f, notes: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
            <button
              onClick={() => {
                const amt = parseFloat(retainForm.amount);
                if (!amt || isNaN(amt)) return;
                retainMut.mutate({
                  date: retainForm.date,
                  amount: amt,
                  notes: retainForm.notes,
                });
              }}
              disabled={retainMut.isPending || !retainForm.amount}
              className="self-end px-4 py-2 text-xs bg-secondary text-bg rounded-full hover:opacity-90 transition font-semibold cursor-pointer disabled:opacity-40"
            >
              {retainMut.isPending ? "Saving…" : "Retain Profit"}
            </button>
            {retainMsg && <p className="text-xs text-positive">{retainMsg}</p>}
          </div>
          <HistoryTable
            entries={capital?.retentions ?? []}
            label="Retention History"
            loading={loading}
          />
        </Card>
      </section>
    </div>
  );
}

// ── Capital entry history table ────────────────────────────────
// Extract group prefix from notes: "prefix:text" → prefix
function extractGroup(notes: string): string | null {
  const m = notes?.match(/^([^:]+):/);
  return m ? m[1].trim() : null;
}

function HistoryTable({
  entries,
  label,
  loading,
}: {
  entries: CapitalEntry[];
  label: string;
  loading: boolean;
}) {
  const [groupFilter, setGroupFilter] = useState<string>("all");

  if (loading) return <Skeleton h="h-24" />;
  if (entries.length === 0) return null;

  // Collect unique groups
  const groups = [
    "all",
    ...Array.from(
      new Set(
        entries.map((e) => extractGroup(e.notes)).filter(Boolean) as string[],
      ),
    ),
  ];

  const filtered =
    groupFilter === "all"
      ? entries
      : entries.filter((e) => extractGroup(e.notes) === groupFilter);

  const groupTotal = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-faint uppercase tracking-wide">
          {label}
        </p>
        {groups.length > 1 && (
          <span className="text-[10px] font-mono text-primary">
            {formatCurrency(groupTotal)}
          </span>
        )}
      </div>

      {/* Group filter pills */}
      {groups.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition cursor-pointer ${groupFilter === g ? "bg-primary text-bg" : "bg-elevated text-faint hover:text-fg border border-border"}`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1 max-h-44 overflow-y-auto">
        {[...filtered].reverse().map((e, i) => {
          const group = extractGroup(e.notes);
          const remarkText = group
            ? e.notes.slice(group.length + 1).trim()
            : e.notes;
          return (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-elevated hover:bg-elevated/80 transition"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-mono font-semibold text-fg">
                  {formatCurrency(e.amount)}
                </span>
                <div className="flex items-center gap-1.5">
                  {group && (
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {group}
                    </span>
                  )}
                  {remarkText && (
                    <span className="text-[10px] text-faint">{remarkText}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-faint">
                {formatDate(e.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SHARED SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface rounded-2xl border border-border p-4 ${className}`}
    >
      {children}
    </div>
  );
}

type Accent = "primary" | "secondary" | "positive" | "danger" | "warning";
const ACCENT: Record<Accent, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  positive: "bg-positive/10 text-positive",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
};

function MiniCard({
  label,
  icon,
  accent,
  loading,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  accent: Accent;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted font-medium leading-none">
          {label}
        </span>
        <span className={`p-1.5 rounded-lg ${ACCENT[accent]}`}>{icon}</span>
      </div>
      {loading ? (
        <Skeleton h="h-5" w="w-24" />
      ) : (
        <div className="flex flex-col gap-0.5">{children}</div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  sub,
  icon,
}: {
  title: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted">{icon}</span>}
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {sub && (
        <span className="text-[10px] text-faint bg-elevated px-2 py-0.5 rounded-full">
          {sub}
        </span>
      )}
    </div>
  );
}

function Skeleton({ h, w = "w-full" }: { h: string; w?: string }) {
  return <div className={`${h} ${w} bg-elevated rounded-lg animate-pulse`} />;
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-16">
      <p className="text-xs text-faint">{msg}</p>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted w-14 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full bg-elevated border border-border rounded-xl px-3 py-1.5 text-xs text-fg placeholder:text-faint outline-none focus:border-primary transition";

function today() {
  return new Date().toISOString().slice(0, 10);
}
