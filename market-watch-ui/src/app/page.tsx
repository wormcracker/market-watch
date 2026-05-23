"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAppStore } from "@/store/app";
import type { SummaryData } from "@/lib/types";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Search,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

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

const tt = {
  background: "var(--color-elevated)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  color: "var(--color-fg)",
  fontSize: "11px",
};

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const prices = useAppStore((s) => s.prices);
  const wsStatus = useAppStore((s) => s.wsStatus);
  const positions = useAppStore((s) => s.positions) ?? [];
  const capital = useAppStore((s) => s.capital);
  const trades = useAppStore((s) => s.trades);
  const summaryAll = useAppStore((s) => s.summaryAll);

  const [summaryFilter, setSummaryFilter] = useState("all");
  const [filterInput, setFilterInput] = useState("all");

  const { data: summary } = useQuery<SummaryData>({
    queryKey: ["summary", summaryFilter],
    queryFn: () =>
      apiFetch<SummaryData>(`stocks/summary?filter=${summaryFilter}`),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const enriched = useMemo(() => {
    return positions.map((p) => {
      const live = prices[p.symbol];
      const ltp = live?.ltp ?? p.ltp;
      const chgPct = live?.percentChange ?? p.chgPct;
      const currentVal = ltp * p.qty;
      const netPL = currentVal - p.invested;
      const plPct = p.invested > 0 ? (netPL / p.invested) * 100 : 0;
      return { ...p, ltp, chgPct, currentVal, netPL, plPct };
    });
  }, [positions, prices]);

  const totalInvested = enriched.reduce((s, p) => s + p.invested, 0);
  const totalCurrentVal = enriched.reduce((s, p) => s + p.currentVal, 0);
  const totalUnrealizedPL = totalCurrentVal - totalInvested;
  const totalUnrealizedPct =
    totalInvested > 0 ? (totalUnrealizedPL / totalInvested) * 100 : 0;

  const portfolioMovers = useMemo(() => {
    const withPrices = enriched.map((p) => ({
      symbol: p.symbol,
      ltp: p.ltp,
      percentChange: p.chgPct,
    }));
    const sorted = [...withPrices].sort(
      (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange),
    );
    const gainers = sorted.filter((s) => s.percentChange > 0);
    const losers = sorted.filter((s) => s.percentChange < 0);
    return { gainers, losers };
  }, [enriched]);

  const sellTrades = trades.filter((t) => t.type === "sell");

  const cumulativePL = useMemo(() => {
    const sorted = [...sellTrades].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    let running = 0;
    return sorted.map((t) => {
      running += t.netPl;
      return { date: t.dateStr ?? t.date.slice(0, 10), pl: running };
    });
  }, [sellTrades]);

  const monthlyPL = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of sellTrades) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] ?? 0) + t.netPl;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, pl]) => ({ month: month.slice(2), pl }));
  }, [sellTrades]);

  const holdingBuckets = useMemo(() => {
    const b: Record<string, number> = {
      "< 7d": 0,
      "7-30d": 0,
      "1-3m": 0,
      "3-6m": 0,
      "> 6m": 0,
    };
    for (const t of sellTrades) {
      const d = t.holdingDays ?? 0;
      if (d < 7) b["< 7d"]++;
      else if (d < 30) b["7-30d"]++;
      else if (d < 90) b["1-3m"]++;
      else if (d < 180) b["3-6m"]++;
      else b["> 6m"]++;
    }
    return Object.entries(b).map(([label, count]) => ({ label, count }));
  }, [sellTrades]);

  const wins = sellTrades.filter((t) => t.netPl > 0).length;
  const losses = sellTrades.length - wins;

  const pieData = enriched
    .filter((p) => p.currentVal > 0)
    .map((p) => ({ name: p.symbol, value: p.currentVal }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-4 pb-8 max-w-screen-2xl mx-auto w-full page-enter">
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Total Invested"
          icon={<DollarSign size={14} />}
          accent="primary"
        >
          <span className="text-base font-mono font-semibold text-fg">
            {formatCurrency(totalInvested)}
          </span>
          {capital && (
            <span className="text-[10px] text-faint">
              Cap: {formatCurrency(capital.tradingCapital)}
            </span>
          )}
        </StatCard>

        <StatCard
          label="Current Value"
          icon={<BarChart3 size={14} />}
          accent="secondary"
        >
          <span className="text-base font-mono font-semibold text-fg">
            {formatCurrency(totalCurrentVal)}
          </span>
          {capital && (
            <span className="text-[10px] text-faint">
              Avail: {formatCurrency(capital.availableCapital)}
            </span>
          )}
        </StatCard>

        <StatCard
          label="Unrealized P&L"
          icon={
            totalUnrealizedPL >= 0 ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingDown size={14} />
            )
          }
          accent={totalUnrealizedPL >= 0 ? "positive" : "danger"}
        >
          <span
            className={`text-base font-mono font-semibold ${totalUnrealizedPL >= 0 ? "text-positive" : "text-danger"}`}
          >
            {totalUnrealizedPL >= 0 ? "+" : ""}
            {formatCurrency(totalUnrealizedPL)}
          </span>
          <span
            className={`text-[10px] font-mono ${totalUnrealizedPct >= 0 ? "text-positive" : "text-danger"}`}
          >
            {formatPercent(totalUnrealizedPct)} · {enriched.length} pos
          </span>
        </StatCard>

        <StatCard
          label="Realized P&L (All‑time)"
          icon={<Activity size={14} />}
          accent={summaryAll && summaryAll.profit >= 0 ? "positive" : "danger"}
        >
          {summaryAll ? (
            <>
              <span
                className={`text-base font-mono font-semibold ${summaryAll.profit >= 0 ? "text-positive" : "text-danger"}`}
              >
                {formatCurrency(summaryAll.profit)}
              </span>
              <span
                className={`text-[10px] font-mono ${summaryAll.plPct >= 0 ? "text-positive" : "text-danger"}`}
              >
                {formatPercent(summaryAll.plPct)} · CAGR{" "}
                {formatPercent(summaryAll.caagr)}
              </span>
            </>
          ) : (
            <Skeleton h="h-5" w="w-28" />
          )}
        </StatCard>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <Card className="lg:col-span-2 flex flex-col gap-3 min-w-0">
          <SectionHeader title="Portfolio Allocation" />
          {pieData.length === 0 ? (
            <Empty msg="No positions" />
          ) : mounted ? (
            <div className="flex gap-3 items-center min-w-0">
              <div className="w-36 h-36 shrink-0 min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={0}
                  debounce={50}
                >
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={34}
                      outerRadius={60}
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
                      formatter={(v: unknown) => [
                        formatCurrency(Number(v)),
                        "",
                      ]}
                      contentStyle={tt}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex flex-col gap-1.5 flex-1 min-w-0">
                {pieData.slice(0, 8).map((entry, i) => {
                  const pct =
                    totalCurrentVal > 0
                      ? (entry.value / totalCurrentVal) * 100
                      : 0;
                  return (
                    <li
                      key={entry.name}
                      className="flex items-center gap-2 cursor-pointer group"
                      onClick={() => router.push(`/stocks/${entry.name}`)}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      <span className="text-xs font-mono text-fg group-hover:text-primary transition truncate flex-1">
                        {entry.name}
                      </span>
                      <span className="text-[10px] text-muted shrink-0">
                        {pct.toFixed(1)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <ChartSkeleton />
          )}
        </Card>

        <Card className="lg:col-span-3 flex flex-col gap-3 max-h-64 overflow-auto min-w-0">
          <div className="flex items-center justify-between">
            <SectionHeader title="Portfolio Movers" />
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                wsStatus === "connected"
                  ? "bg-positive/10 text-positive border-positive/20"
                  : wsStatus === "connecting"
                    ? "bg-warning/10 text-warning border-warning/20 animate-pulse"
                    : "bg-danger/10 text-danger border-danger/20"
              }`}
            >
              {wsStatus} · {enriched.length} stocks
            </span>
          </div>

          {enriched.length === 0 ? (
            <Empty msg="No portfolio positions" />
          ) : (
            <div className="grid grid-cols-2 gap-x-3">
              <div>
                <p className="text-[10px] text-positive font-semibold uppercase tracking-widest mb-1.5 px-2">
                  Gainers
                </p>
                {portfolioMovers.gainers.length === 0 ? (
                  <p className="text-xs text-faint px-2">None today</p>
                ) : (
                  portfolioMovers.gainers.map((s) => (
                    <MoverRow
                      key={s.symbol}
                      symbol={s.symbol}
                      ltp={s.ltp}
                      percentChange={s.percentChange}
                      onClick={() => router.push(`/stocks/${s.symbol}`)}
                    />
                  ))
                )}
              </div>
              <div>
                <p className="text-[10px] text-danger font-semibold uppercase tracking-widest mb-1.5 px-2">
                  Losers
                </p>
                {portfolioMovers.losers.length === 0 ? (
                  <p className="text-xs text-faint px-2">None today</p>
                ) : (
                  portfolioMovers.losers.map((s) => (
                    <MoverRow
                      key={s.symbol}
                      symbol={s.symbol}
                      ltp={s.ltp}
                      percentChange={s.percentChange}
                      onClick={() => router.push(`/stocks/${s.symbol}`)}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2 flex flex-col gap-3 min-w-0">
          <SectionHeader
            title="Cumulative Realized P&L"
            sub={`${sellTrades.length} sells`}
          />
          {cumulativePL.length < 2 ? (
            <Empty msg="Not enough trade data" />
          ) : mounted ? (
            <ChartBox height={148}>
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
                debounce={50}
              >
                <LineChart
                  data={cumulativePL}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
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
                    formatter={(v: unknown) => [
                      formatCurrency(Number(v)),
                      "Cumulative P&L",
                    ]}
                    contentStyle={tt}
                    labelStyle={{ color: "var(--color-muted)", fontSize: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pl"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--color-primary)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          ) : (
            <ChartSkeleton />
          )}
        </Card>

        <Card className="flex flex-col gap-3 min-w-0">
          <SectionHeader
            title="Win / Loss"
            sub={
              sellTrades.length > 0
                ? `${((wins / sellTrades.length) * 100).toFixed(0)}% win rate`
                : undefined
            }
          />
          {sellTrades.length === 0 ? (
            <Empty msg="No sell trades" />
          ) : mounted ? (
            <ChartBox height={110}>
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
                debounce={50}
              >
                <PieChart>
                  <Pie
                    data={[
                      { name: "Wins", value: wins },
                      { name: "Losses", value: losses },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={48}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill="var(--color-positive)" />
                    <Cell fill="var(--color-danger)" />
                  </Pie>
                  <Tooltip contentStyle={tt} />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>
          ) : (
            <ChartSkeleton height={110} />
          )}
          <div className="flex gap-5">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-2 h-2 rounded-full bg-positive" />
              Wins <strong className="text-fg font-mono">{wins}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-2 h-2 rounded-full bg-danger" />
              Losses <strong className="text-fg font-mono">{losses}</strong>
            </span>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="flex flex-col gap-3 min-w-0">
          <SectionHeader title="Monthly Realized P&L" />
          {monthlyPL.length === 0 ? (
            <Empty msg="No monthly data" />
          ) : mounted ? (
            <ChartBox height={148}>
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
                debounce={50}
              >
                <BarChart
                  data={monthlyPL}
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
                      "Realized P&L",
                    ]}
                    contentStyle={tt}
                    labelStyle={{ color: "var(--color-muted)", fontSize: 10 }}
                  />
                  <Bar dataKey="pl" radius={[3, 3, 0, 0]}>
                    {monthlyPL.map((e, i) => (
                      <Cell
                        key={i}
                        fill={
                          e.pl >= 0
                            ? "var(--color-positive)"
                            : "var(--color-danger)"
                        }
                        fillOpacity={0.82}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          ) : (
            <ChartSkeleton height={148} />
          )}
        </Card>

        <Card className="flex flex-col gap-3 min-w-0">
          <SectionHeader title="Holding Duration" sub="by sell count" />
          {sellTrades.length === 0 ? (
            <Empty msg="No sell trades" />
          ) : mounted ? (
            <ChartBox height={148}>
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
                debounce={50}
              >
                <BarChart
                  data={holdingBuckets}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                    tickLine={false}
                    axisLine={false}
                    width={24}
                  />
                  <Tooltip contentStyle={tt} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-secondary)"
                    fillOpacity={0.75}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          ) : (
            <ChartSkeleton height={148} />
          )}
        </Card>
      </section>

      <Card className="flex flex-col gap-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SectionHeader
            title="Summary"
            sub={summary ? `filter: ${summary.filter}` : undefined}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSummaryFilter(filterInput.trim() || "all");
            }}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-2 bg-elevated border border-border rounded-full px-3 py-1.5">
              <Search size={11} className="text-faint shrink-0" />
              <input
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                placeholder="all · jan · 2024 · NABIL"
                className="bg-transparent text-xs text-fg placeholder:text-faint outline-none w-36 md:w-44"
              />
            </div>
            <button
              type="submit"
              className="text-xs bg-primary text-bg px-3 py-1.5 rounded-full hover:bg-primary-strong transition font-medium cursor-pointer"
            >
              Apply
            </button>
          </form>
        </div>

        {!summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} h="h-14" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {(
              [
                {
                  label: "Realized P&L",
                  value: formatCurrency(summary.profit),
                  color: summary.profit >= 0 ? "positive" : "danger",
                },
                {
                  label: "P&L %",
                  value: formatPercent(summary.plPct),
                  color: summary.plPct >= 0 ? "positive" : "danger",
                },
                {
                  label: "CAGR",
                  value: formatPercent(summary.caagr),
                  color: summary.caagr >= 0 ? "positive" : "danger",
                },
                {
                  label: "All-time P&L",
                  value: formatCurrency(summary.allTimeProfit),
                  color: summary.allTimeProfit >= 0 ? "positive" : "danger",
                },
                {
                  label: "All-time %",
                  value: formatPercent(summary.allTimePLPct),
                  color: summary.allTimePLPct >= 0 ? "positive" : "danger",
                },
                {
                  label: "Buy Turnover",
                  value: formatCurrency(summary.buyTurnover),
                  sub: `${summary.buyCount} trades`,
                },
                {
                  label: "Sell Turnover",
                  value: formatCurrency(summary.sellTurnover),
                  sub: `${summary.sellCount} trades`,
                },
                {
                  label: "Commission",
                  value: formatCurrency(summary.commissionPaid),
                },
                { label: "CGT Paid", value: formatCurrency(summary.cgtPaid) },
                { label: "Avg Hold", value: `${summary.avgHoldDays} days` },
                { label: "Leftover", value: formatCurrency(summary.leftAmt) },
                {
                  label: "All-time Leftover",
                  value: formatCurrency(summary.allTimeLeftover),
                },
                {
                  label: "First Trade",
                  value: formatDate(summary.firstTradeDate),
                },
                {
                  label: "Last Trade",
                  value: formatDate(summary.lastTradeDate),
                },
              ] as Array<{
                label: string;
                value: string;
                color?: string;
                sub?: string;
              }>
            ).map((row) => (
              <div
                key={row.label}
                className="bg-elevated rounded-xl p-3 flex flex-col gap-0.5"
              >
                <span className="text-[10px] text-faint uppercase tracking-wide leading-none mb-0.5">
                  {row.label}
                </span>
                <span
                  className={`text-sm font-mono font-semibold leading-tight ${
                    row.color === "positive"
                      ? "text-positive"
                      : row.color === "danger"
                        ? "text-danger"
                        : "text-fg"
                  }`}
                >
                  {row.value}
                </span>
                {row.sub && (
                  <span className="text-[10px] text-faint mt-0.5">
                    {row.sub}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface rounded-2xl border border-border p-4 ${className} min-w-0`}
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

function StatCard({
  label,
  icon,
  accent,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  accent: Accent;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted font-medium">{label}</span>
        <span className={`p-1.5 rounded-lg ${ACCENT[accent]}`}>{icon}</span>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function MoverRow({
  symbol,
  ltp,
  percentChange,
  onClick,
}: {
  symbol: string;
  ltp: number;
  percentChange: number;
  onClick: () => void;
}) {
  const up = percentChange >= 0;
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full py-1 px-2 rounded-lg hover:bg-elevated/70 transition-colors text-left cursor-pointer"
    >
      <span className="font-mono text-xs font-semibold text-fg">{symbol}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-muted">
          {ltp.toFixed(2)}
        </span>
        <span
          className={`flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums ${up ? "text-positive" : "text-danger"}`}
        >
          {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {Math.abs(percentChange).toFixed(2)}%
        </span>
      </div>
    </button>
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
    <div className="flex items-center gap-2 min-w-0">
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

function ChartBox({
  children,
  height = 148,
}: {
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div
      className="w-full min-w-0 overflow-hidden"
      style={{ height, minWidth: 0 }}
    >
      {children}
    </div>
  );
}

function ChartSkeleton({ height = 148 }: { height?: number }) {
  return (
    <div
      className="w-full min-w-0 bg-elevated rounded-lg animate-pulse"
      style={{ height }}
    />
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
