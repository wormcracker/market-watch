"use client";
import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import type { Position } from "@/lib/types";
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpDown, ArrowUp, ArrowDown,
  PieChart as PieIcon, Layers, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  Cell, PieChart, Pie, CartesianGrid,
} from "recharts";
import { DemoBanner } from "@/components/layout/demo-banner";
import { useRouter } from "next/navigation";

type Tab = "positions" | "capital";
type SortField = keyof Position;
type SortDir = "asc" | "desc";

const tt = {
  background: "var(--color-elevated)", border: "1px solid var(--color-border)",
  borderRadius: "10px", color: "var(--color-fg)", fontSize: "11px",
};
const PIE_COLORS = ["var(--color-primary)","var(--color-secondary)","var(--color-positive)","var(--color-warning)","var(--color-primary-dim)","var(--color-secondary-dim)","var(--color-danger)","var(--color-faint)"];

export default function PortfolioPage() {
  const router = useRouter();
  const prices = useAppStore(s => s.prices);
  const storePositions = useAppStore(s => s.positions);
  const capital = useAppStore(s => s.capital);

  const [tab, setTab] = useState<Tab>("positions");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "currentVal", dir: "desc" });

  const enriched = useMemo(() => storePositions.map(p => {
    const live = prices[p.symbol];
    const ltp = live?.ltp ?? p.ltp;
    const chgPct = live?.percentChange ?? p.chgPct;
    const currentVal = ltp * p.qty;
    const netPL = currentVal - p.invested;
    const plPct = p.invested > 0 ? (netPL / p.invested) * 100 : 0;
    return { ...p, ltp, chgPct, currentVal, netPL, plPct };
  }), [storePositions, prices]);

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      const av = a[sort.field] as number;
      const bv = b[sort.field] as number;
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }, [enriched, sort]);

  const totalInvested   = enriched.reduce((s, p) => s + p.invested, 0);
  const totalCurrentVal = enriched.reduce((s, p) => s + p.currentVal, 0);
  const totalPL         = enriched.reduce((s, p) => s + p.netPL, 0);
  const totalPLPct      = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const pieData = enriched.map(p => ({ name: p.symbol, value: p.currentVal }));

  function toggleSort(field: SortField) {
    setSort(s => s.field === field ? { field, dir: s.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" });
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort.field !== field) return <ArrowUpDown size={11} className="text-faint" />;
    return sort.dir === "asc" ? <ArrowUp size={11} className="text-primary" /> : <ArrowDown size={11} className="text-primary" />;
  }

  return (
    <div className="flex flex-col gap-4 pb-10 max-w-screen-2xl mx-auto w-full">
      <DemoBanner />

      <div className="flex items-center gap-1 bg-surface border border-border rounded-2xl p-1 w-fit">
        {(["positions", "capital"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-medium capitalize transition-all cursor-pointer ${
              tab === t ? "bg-primary text-bg shadow-sm" : "text-muted hover:text-fg hover:bg-elevated"
            }`}
          >{t}</button>
        ))}
      </div>

      {tab === "positions" && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:"Invested",      value: formatCurrency(totalInvested),   icon:<Wallet size={14}/>,    positive:true },
              { label:"Current Value", value: formatCurrency(totalCurrentVal), icon:<DollarSign size={14}/>, positive:totalPL>=0 },
              { label:"Unrealized P&L",value: formatCurrency(totalPL),        icon: totalPL>=0?<TrendingUp size={14}/>:<TrendingDown size={14}/>, positive:totalPL>=0 },
              { label:"Return",        value: formatPercent(totalPLPct),       icon:<Layers size={14}/>,     positive:totalPLPct>=0 },
            ].map(k => (
              <div key={k.label} className="bg-surface border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted">{k.label}</p>
                  <span className={`p-1.5 rounded-lg ${k.positive ? "bg-positive/10 text-positive" : "bg-danger/10 text-danger"}`}>{k.icon}</span>
                </div>
                <p className={`text-base font-semibold font-mono ${k.positive ? "text-fg" : "text-danger"}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Bar chart */}
            <div className="md:col-span-2 bg-surface border border-border rounded-2xl p-4">
              <p className="text-sm font-semibold text-fg mb-3">P&L by Stock</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={enriched.map(p => ({ symbol: p.symbol, pl: p.netPL }))}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" tick={{ fontSize: 10, fill: "var(--color-faint)" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-faint)" }} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={tt} formatter={(v: number) => [formatCurrency(v), "P&L"]} />
                  <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                    {enriched.map((p, i) => <Cell key={i} fill={p.netPL >= 0 ? "var(--color-positive)" : "var(--color-danger)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie */}
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-sm font-semibold text-fg mb-1">Allocation</p>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tt} formatter={(v: number) => [formatCurrency(v)]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1 mt-1">
                {pieData.slice(0, 5).map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-[10px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i] }} />
                    <span className="text-muted flex-1">{d.name}</span>
                    <span className="text-fg font-mono">{((d.value / totalCurrentVal) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      { label:"Symbol", field:"symbol" as SortField },
                      { label:"Qty",    field:"qty" as SortField },
                      { label:"Avg Buy",field:"avgBuy" as SortField },
                      { label:"LTP",    field:"ltp" as SortField },
                      { label:"Invested",field:"invested" as SortField },
                      { label:"Value",  field:"currentVal" as SortField },
                      { label:"P&L",    field:"netPL" as SortField },
                      { label:"Chg%",   field:"chgPct" as SortField },
                      { label:"",       field:null },
                    ].map(col => (
                      <th
                        key={col.label}
                        onClick={() => col.field && toggleSort(col.field)}
                        className={`px-4 py-3 text-left text-muted font-medium whitespace-nowrap ${col.field ? "cursor-pointer hover:text-fg" : ""}`}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.field && <SortIcon field={col.field} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => (
                    <tr key={p.symbol} className="border-b border-border/50 hover:bg-elevated/30 transition cursor-pointer" onClick={() => router.push(`/stocks?symbol=${p.symbol}`)}>
                      <td className="px-4 py-3 font-semibold text-fg">{p.symbol}</td>
                      <td className="px-4 py-3 text-muted font-mono">{p.qty}</td>
                      <td className="px-4 py-3 text-muted font-mono">{p.avgBuy.toFixed(1)}</td>
                      <td className="px-4 py-3 font-mono text-fg">{p.ltp.toFixed(1)}</td>
                      <td className="px-4 py-3 font-mono text-muted">{formatCurrency(p.invested)}</td>
                      <td className="px-4 py-3 font-mono text-fg">{formatCurrency(p.currentVal)}</td>
                      <td className={`px-4 py-3 font-mono font-semibold ${p.netPL >= 0 ? "text-positive" : "text-danger"}`}>
                        {formatCurrency(p.netPL)}
                        <span className="ml-1 text-[10px] opacity-70">({formatPercent(p.plPct)})</span>
                      </td>
                      <td className={`px-4 py-3 font-mono ${p.chgPct >= 0 ? "text-positive" : "text-danger"}`}>
                        {formatPercent(p.chgPct)}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight size={14} className="text-faint" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "capital" && capital && (
        <div className="flex flex-col gap-4">
          {/* Capital KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:"Total Added",     value: formatCurrency(capital.totalCapitalAdded) },
              { label:"Trading Capital", value: formatCurrency(capital.tradingCapital) },
              { label:"Deployed",        value: formatCurrency(capital.deployedCapital) },
              { label:"Available",       value: formatCurrency(capital.availableCapital) },
            ].map(k => (
              <div key={k.label} className="bg-surface border border-border rounded-2xl p-4">
                <p className="text-xs text-muted mb-1">{k.label}</p>
                <p className="text-base font-semibold font-mono text-fg">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Capital breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-sm font-semibold text-fg mb-3">Capital Additions</p>
              <div className="flex flex-col gap-2">
                {capital.additions.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div>
                      <p className="text-xs text-fg font-medium">{formatDate(a.date)}</p>
                      <p className="text-[10px] text-faint">{a.notes}</p>
                    </div>
                    <span className="text-sm font-mono text-positive">+{formatCurrency(a.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-sm font-semibold text-fg mb-3">Capital Retained</p>
              <div className="flex flex-col gap-2">
                {capital.retentions.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div>
                      <p className="text-xs text-fg font-medium">{formatDate(r.date)}</p>
                      <p className="text-[10px] text-faint">{r.notes}</p>
                    </div>
                    <span className="text-sm font-mono text-warning">+{formatCurrency(r.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Capital gauge */}
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-sm font-semibold text-fg mb-4">Capital Utilisation</p>
            <div className="flex flex-col gap-3">
              {[
                { label: "Deployed", amount: capital.deployedCapital,   color: "var(--color-primary)" },
                { label: "Reserved", amount: capital.reservedCapital,    color: "var(--color-warning)" },
                { label: "Available",amount: capital.availableCapital,   color: "var(--color-positive)" },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted">{row.label}</span>
                    <span className="text-fg font-mono">{formatCurrency(row.amount)}</span>
                  </div>
                  <div className="h-2 bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(row.amount / capital.tradingCapital) * 100}%`, background: row.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
