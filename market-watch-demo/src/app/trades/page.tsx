"use client";
import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import type { Trade } from "@/lib/types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  TrendingUp, TrendingDown, Lock,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import { DemoBanner } from "@/components/layout/demo-banner";

type SortField = keyof Trade;
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "buy" | "sell";

const PAGE_SIZE = 15;
const tt = {
  background: "var(--color-elevated)", border: "1px solid var(--color-border)",
  borderRadius: "10px", color: "var(--color-fg)", fontSize: "11px",
};

export default function TradesPage() {
  const trades = useAppStore(s => s.trades);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "date", dir: "desc" });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return trades
      .filter(t => typeFilter === "all" || t.type === typeFilter)
      .filter(t => !search || t.symbol.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const av = a[sort.field];
        const bv = b[sort.field];
        if (typeof av === "string" && typeof bv === "string")
          return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        return sort.dir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
      });
  }, [trades, typeFilter, search, sort]);

  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function toggleSort(field: SortField) {
    setSort(s => s.field === field ? { field, dir: s.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" });
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort.field !== field) return <ArrowUpDown size={11} className="text-faint" />;
    return sort.dir === "asc" ? <ArrowUp size={11} className="text-primary" /> : <ArrowDown size={11} className="text-primary" />;
  }

  // Realized trades
  const realised = trades.filter(t => t.type === "sell");
  const totalRealizedPL = realised.reduce((s, t) => s + t.netPl, 0);
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    realised.forEach(t => { const m = t.date.slice(5, 7); map[m] = (map[m] ?? 0) + t.netPl; });
    return Object.entries(map).sort().map(([m, pl]) => ({ month: m, pl }));
  }, [realised]);

  return (
    <div className="flex flex-col gap-4 pb-10 max-w-screen-2xl mx-auto w-full">
      <DemoBanner />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:"Total Trades",    value: `${trades.length}` },
          { label:"Buy Trades",      value: `${trades.filter(t=>t.type==="buy").length}` },
          { label:"Sell Trades",     value: `${trades.filter(t=>t.type==="sell").length}` },
          { label:"Realized P&L",   value: formatCurrency(totalRealizedPL), positive: totalRealizedPL >= 0 },
        ].map(k => (
          <div key={k.label} className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-xs text-muted mb-1">{k.label}</p>
            <p className={`text-base font-semibold font-mono ${"positive" in k ? (k.positive ? "text-positive" : "text-danger") : "text-fg"}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Monthly bar chart */}
      {monthlyData.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-sm font-semibold text-fg mb-3">Monthly Realized P&L</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-faint)" }} tickLine={false} />
              <Tooltip contentStyle={tt} formatter={(v: number) => [formatCurrency(v), "P&L"]} />
              <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                {monthlyData.map((d, i) => <Cell key={i} fill={d.pl >= 0 ? "var(--color-positive)" : "var(--color-danger)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters + locked CTA */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
            {(["all","buy","sell"] as TypeFilter[]).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                  typeFilter === f ? "bg-primary text-bg" : "text-muted hover:text-fg hover:bg-elevated"
                }`}
              >{f}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2">
            <Search size={13} className="text-faint" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search symbol…"
              className="bg-transparent text-xs text-fg placeholder:text-faint outline-none w-24"
            />
          </div>
        </div>

        {/* Locked: add trade */}
        <div className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-xl text-[11px] text-faint border border-border">
          <Lock size={11} />
          Add Trade — local build only
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {[
                  { label:"Date",    field:"date" as SortField },
                  { label:"Symbol",  field:"symbol" as SortField },
                  { label:"Type",    field:"type" as SortField },
                  { label:"Qty",     field:"qty" as SortField },
                  { label:"Buy WACC",field:"buyWacc" as SortField },
                  { label:"Sell",    field:"sellPrice" as SortField },
                  { label:"Hold",    field:"holdingDays" as SortField },
                  { label:"Comm.",   field:"commission" as SortField },
                  { label:"CGT",     field:"profitTax" as SortField },
                  { label:"Net P&L", field:"netPl" as SortField },
                ].map(col => (
                  <th key={col.label} onClick={() => toggleSort(col.field)}
                    className="px-4 py-3 text-left text-muted font-medium whitespace-nowrap cursor-pointer hover:text-fg">
                    <span className="flex items-center gap-1">{col.label}<SortIcon field={col.field} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map(t => (
                <tr key={t.tradeId} className="border-b border-border/50 hover:bg-elevated/30 transition">
                  <td className="px-4 py-3 text-muted">{formatDate(t.date)}</td>
                  <td className="px-4 py-3 font-semibold text-fg">{t.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      t.type === "buy" ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"
                    }`}>{t.type}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">{t.qty}</td>
                  <td className="px-4 py-3 font-mono text-muted">{t.buyWacc.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-muted">{t.type === "sell" ? t.sellPrice.toFixed(2) : "—"}</td>
                  <td className="px-4 py-3 text-muted">{t.holdingDays > 0 ? `${t.holdingDays}d` : "—"}</td>
                  <td className="px-4 py-3 font-mono text-muted">{formatCurrency(t.commission)}</td>
                  <td className="px-4 py-3 font-mono text-muted">{t.profitTax > 0 ? formatCurrency(t.profitTax) : "—"}</td>
                  <td className={`px-4 py-3 font-mono font-semibold ${t.netPl > 0 ? "text-positive" : t.netPl < 0 ? "text-danger" : "text-muted"}`}>
                    {t.type === "sell" ? formatCurrency(t.netPl) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-faint">{filtered.length} trades</p>
            <div className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg text-xs text-muted disabled:opacity-40 hover:bg-elevated transition cursor-pointer">Prev</button>
              <span className="text-xs text-muted">{page + 1} / {totalPages}</span>
              <button disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg text-xs text-muted disabled:opacity-40 hover:bg-elevated transition cursor-pointer">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
