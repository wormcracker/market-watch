"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/app";
import { formatCurrency, formatPercent, formatLargeNum } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid,
} from "recharts";
import { DemoBanner } from "@/components/layout/demo-banner";

const PIE_COLORS = [
  "var(--color-primary)", "var(--color-secondary)", "var(--color-positive)",
  "var(--color-warning)", "var(--color-primary-dim)", "var(--color-secondary-dim)",
  "var(--color-danger)", "var(--color-faint)",
];

const tt = {
  background: "var(--color-elevated)", border: "1px solid var(--color-border)",
  borderRadius: "10px", color: "var(--color-fg)", fontSize: "11px",
};

// Simulated NAV history for the line chart
const NAV_HISTORY = [
  { date:"Jan", value:100000 }, { date:"Feb", value:108500 }, { date:"Mar", value:115200 },
  { date:"Apr", value:112800 }, { date:"May", value:121500 }, { date:"Jun", value:118900 },
  { date:"Jul", value:125300 }, { date:"Aug", value:131700 }, { date:"Sep", value:128400 },
  { date:"Oct", value:138200 }, { date:"Nov", value:142600 }, { date:"Dec", value:149800 },
  { date:"Jan '26", value:155200 }, { date:"Feb '26", value:161500 }, { date:"May '26", value:168355 },
];

export default function DashboardPage() {
  const router = useRouter();
  const prices    = useAppStore(s => s.prices);
  const positions = useAppStore(s => s.positions) ?? [];
  const capital   = useAppStore(s => s.capital);
  const summary   = useAppStore(s => s.summary);
  const trades    = useAppStore(s => s.trades);

  const enriched = useMemo(() => positions.map(p => {
    const live = prices[p.symbol];
    const ltp = live?.ltp ?? p.ltp;
    const chgPct = live?.percentChange ?? p.chgPct;
    const currentVal = ltp * p.qty;
    const netPL = currentVal - p.invested;
    const plPct = p.invested > 0 ? (netPL / p.invested) * 100 : 0;
    return { ...p, ltp, chgPct, currentVal, netPL, plPct };
  }), [positions, prices]);

  const totalInvested   = enriched.reduce((s, p) => s + p.invested, 0);
  const totalCurrentVal = enriched.reduce((s, p) => s + p.currentVal, 0);
  const totalPL         = totalCurrentVal - totalInvested;
  const totalPLPct      = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const pieData = enriched.map(p => ({ name: p.symbol, value: p.currentVal }));

  const gainers = [...enriched].filter(p => p.chgPct > 0).sort((a, b) => b.chgPct - a.chgPct).slice(0, 5);
  const losers  = [...enriched].filter(p => p.chgPct < 0).sort((a, b) => a.chgPct - b.chgPct).slice(0, 5);

  // Realized P&L bar chart from trades
  const monthlyPL = useMemo(() => {
    const map: Record<string, number> = {};
    trades.filter(t => t.type === "sell").forEach(t => {
      const mo = t.date.slice(0, 7);
      map[mo] = (map[mo] ?? 0) + t.netPl;
    });
    return Object.entries(map).map(([m, v]) => ({ month: m.slice(5), pl: v }));
  }, [trades]);

  return (
    <div className="flex flex-col gap-4 pb-10 max-w-screen-2xl mx-auto w-full">
      <DemoBanner />

      {/* ── KPI row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Portfolio Value"
          value={formatCurrency(totalCurrentVal)}
          sub={`${formatPercent(totalPLPct)} unrealized`}
          positive={totalPL >= 0}
          icon={<DollarSign size={16} />}
        />
        <KpiCard
          label="Unrealized P&L"
          value={formatCurrency(totalPL)}
          sub={`Invested ${formatCurrency(totalInvested)}`}
          positive={totalPL >= 0}
          icon={totalPL >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        />
        <KpiCard
          label="Realized Profit"
          value={formatCurrency(summary?.profit ?? 7621)}
          sub={`${(summary?.plPct ?? 11.09).toFixed(2)}% ROIC`}
          positive
          icon={<BarChart3 size={16} />}
        />
        <KpiCard
          label="Available Capital"
          value={formatCurrency(capital?.availableCapital ?? 24475)}
          sub={`of ${formatCurrency(capital?.tradingCapital ?? 185000)} trading cap`}
          positive
          icon={<DollarSign size={16} />}
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* NAV line */}
        <div className="md:col-span-2 bg-surface border border-border rounded-2xl p-4">
          <p className="text-sm font-semibold text-fg mb-3">Portfolio NAV</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={NAV_HISTORY}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-faint)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-faint)" }} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={tt} formatter={(v: number) => [formatCurrency(v), "NAV"]} />
              <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation pie */}
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-sm font-semibold text-fg mb-3">Allocation</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tt} formatter={(v: number) => [formatCurrency(v)]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1 mt-1">
            {pieData.slice(0, 4).map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-[11px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i] }} />
                <span className="text-muted flex-1">{d.name}</span>
                <span className="text-fg font-mono">{((d.value / totalCurrentVal) * 100).toFixed(1)}%</span>
              </div>
            ))}
            {pieData.length > 4 && <p className="text-[10px] text-faint">+{pieData.length - 4} more</p>}
          </div>
        </div>
      </div>

      {/* ── Movers + Monthly PL ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Gainers */}
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-sm font-semibold text-fg mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-positive" /> Top Gainers
          </p>
          <div className="flex flex-col gap-2">
            {gainers.map(p => (
              <div
                key={p.symbol}
                onClick={() => router.push(`/stocks?symbol=${p.symbol}`)}
                className="flex items-center justify-between cursor-pointer hover:bg-elevated rounded-xl px-2 py-1.5 transition"
              >
                <div>
                  <p className="text-xs font-semibold text-fg">{p.symbol}</p>
                  <p className="text-[10px] text-muted">Rs. {p.ltp.toFixed(1)}</p>
                </div>
                <div className="flex items-center gap-1 text-positive text-xs font-mono">
                  <ArrowUpRight size={12} />
                  {formatPercent(p.chgPct)}
                </div>
              </div>
            ))}
            {gainers.length === 0 && <p className="text-xs text-faint">No gainers today</p>}
          </div>
        </div>

        {/* Losers */}
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-sm font-semibold text-fg mb-3 flex items-center gap-1.5">
            <TrendingDown size={14} className="text-danger" /> Top Losers
          </p>
          <div className="flex flex-col gap-2">
            {losers.map(p => (
              <div
                key={p.symbol}
                onClick={() => router.push(`/stocks?symbol=${p.symbol}`)}
                className="flex items-center justify-between cursor-pointer hover:bg-elevated rounded-xl px-2 py-1.5 transition"
              >
                <div>
                  <p className="text-xs font-semibold text-fg">{p.symbol}</p>
                  <p className="text-[10px] text-muted">Rs. {p.ltp.toFixed(1)}</p>
                </div>
                <div className="flex items-center gap-1 text-danger text-xs font-mono">
                  <ArrowDownRight size={12} />
                  {formatPercent(p.chgPct)}
                </div>
              </div>
            ))}
            {losers.length === 0 && <p className="text-xs text-faint">No losers today</p>}
          </div>
        </div>

        {/* Monthly P&L bars */}
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-sm font-semibold text-fg mb-3">Monthly Realized P&L</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyPL}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-faint)" }} tickLine={false} />
              <Tooltip contentStyle={tt} formatter={(v: number) => [formatCurrency(v), "P&L"]} />
              <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                {monthlyPL.map((d, i) => (
                  <Cell key={i} fill={d.pl >= 0 ? "var(--color-positive)" : "var(--color-danger)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Summary stats ───────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-2xl p-4">
        <p className="text-sm font-semibold text-fg mb-3">All-Time Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {[
            { label: "Total Trades",    value: `${(summary?.buyCount ?? 8) + (summary?.sellCount ?? 3)}` },
            { label: "Turnover",        value: formatCurrency(summary?.buyTurnover ?? 171655) },
            { label: "Commission Paid", value: formatCurrency(summary?.commissionPaid ?? 1070) },
            { label: "CGT Paid",        value: formatCurrency(summary?.cgtPaid ?? 647) },
            { label: "Avg Hold Days",   value: `${summary?.avgHoldDays ?? 42}d` },
            { label: "CAAGR",           value: `${(summary?.caagr ?? 19.4).toFixed(1)}%` },
          ].map(s => (
            <div key={s.label}>
              <p className="text-[10px] text-faint uppercase tracking-wider">{s.label}</p>
              <p className="text-sm font-mono font-semibold text-fg mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, positive, icon }: {
  label: string; value: string; sub: string; positive: boolean; icon: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        <span className={`p-1.5 rounded-lg ${positive ? "bg-positive/10 text-positive" : "bg-danger/10 text-danger"}`}>
          {icon}
        </span>
      </div>
      <p className="text-lg font-semibold font-mono text-fg leading-tight">{value}</p>
      <p className="text-[11px] text-faint">{sub}</p>
    </div>
  );
}
