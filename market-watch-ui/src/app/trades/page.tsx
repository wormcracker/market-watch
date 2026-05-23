"use client";

import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiDelete } from "@/lib/api";
import { useAppStore } from "@/store/app";
import type { Trade, WatchlistEntry, TradePreviewResponse } from "@/lib/types";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import {
  Plus,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  Cell,
} from "recharts";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type SortField = keyof Trade;
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "buy" | "sell";

interface TradeFormData {
  date: string;
  symbol: string;
  type: "buy" | "sell";
  qty: string;
  price: string;
  remarks: string;
}

const EMPTY_FORM: TradeFormData = {
  date: today(),
  symbol: "",
  type: "buy",
  qty: "",
  price: "",
  remarks: "",
};

const PAGE_SIZE = 20;

const tt = {
  background: "var(--color-elevated)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  color: "var(--color-fg)",
  fontSize: "11px",
};

export default function TradesPage() {
  return (
    <Suspense>
      <TradesPageInner />
    </Suspense>
  );
}

function TradesPageInner() {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Central store trades
  const storeTrades = useAppStore((s) => s.trades);
  const storePositions = useAppStore((s) => s.positions) ?? [];

  // Filters + URL state
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    (searchParams.get("type") as TypeFilter) || "all",
  );
  const [symbolFilter, setSymbolFilter] = useState(
    searchParams.get("symbol") || "",
  );
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") || "");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: (searchParams.get("sort") as SortField) || "date",
    dir: (searchParams.get("dir") as SortDir) || "desc",
  });
  const [page, setPage] = useState(Number(searchParams.get("page") || 0));
  const [showFilters, setShowFilters] = useState(false);

  // Sync filter/sort/pagination state -> URL
  useEffect(() => {
    const params = new URLSearchParams();

    if (typeFilter !== "all") params.set("type", typeFilter);
    if (symbolFilter) params.set("symbol", symbolFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    if (sort.field !== "date") params.set("sort", sort.field);
    if (sort.dir !== "desc") params.set("dir", sort.dir);

    if (page > 0) params.set("page", String(page));

    const qs = params.toString();

    router.replace(qs ? `${pathname}?${qs}` : pathname, {
      scroll: false,
    });
  }, [
    typeFilter,
    symbolFilter,
    dateFrom,
    dateTo,
    sort,
    page,
    pathname,
    router,
  ]);

  // Drawer
  const [drawer, setDrawer] = useState<"closed" | "add" | "edit">("closed");
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [form, setForm] = useState<TradeFormData>(EMPTY_FORM);
  const [formMsg, setFormMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Use store trades (already fetched by prefetcher)
  const allTrades: Trade[] = storeTrades;

  // Symbols from watchlist (for BUY dropdown) + positions (for SELL)
  const { data: watchlistData } = useQuery<WatchlistEntry[]>({
    queryKey: ["watchlist"],
    queryFn: () => apiFetch<WatchlistEntry[]>("stocks/watchlist"),
    staleTime: 60_000,
  });

  const allWatchlistSymbols = useMemo(
    () =>
      (watchlistData?.stocks ?? [])
        .filter((e) => e.symbol && e.cap !== "Main")
        .map((e) => e.symbol)
        .sort(),
    [watchlistData],
  );

  // Positions with qty > 0 (what you can sell)
  const sellableSymbols = useMemo(
    () =>
      storePositions
        .filter((p) => p.qty > 0)
        .map((p) => p.symbol)
        .sort(),
    [storePositions],
  );

  // Filtered + sorted trades
  const filtered = useMemo(() => {
    return allTrades
      .filter((t) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (
          symbolFilter &&
          !t.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
        )
          return false;
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[sort.field];
        const bv = b[sort.field];
        const cmp =
          typeof av === "string" && typeof bv === "string"
            ? av.localeCompare(bv)
            : Number(av) - Number(bv);
        return sort.dir === "asc" ? cmp : -cmp;
      });
  }, [allTrades, typeFilter, symbolFilter, dateFrom, dateTo, sort]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => setPage(0), [typeFilter, symbolFilter, dateFrom, dateTo]);

  const sellTrades = filtered.filter((t) => t.type === "sell");
  const totalRealizedPL = sellTrades.reduce((s, t) => s + t.netPl, 0);
  const wins = sellTrades.filter((t) => t.netPl > 0).length;
  const totalBuyTurnover = filtered
    .filter((t) => t.type === "buy")
    .reduce((s, t) => s + t.totalBuy, 0);
  const avgHoldDays =
    sellTrades.length > 0
      ? sellTrades.reduce((s, t) => s + t.holdingDays, 0) / sellTrades.length
      : 0;

  const monthlyPL = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of sellTrades) {
      const key = t.date.slice(0, 7);
      map[key] = (map[key] ?? 0) + t.netPl;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, pl]) => ({ month: m.slice(2), pl }));
  }, [sellTrades]);

  // Mutations
  const addMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<Trade>("stocks/trades", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades-all"] });
      qc.invalidateQueries({ queryKey: ["positions"] });
      setFormMsg({ type: "ok", text: "Trade added successfully" });
      setTimeout(() => closeDrawer(), 1200);
    },
    onError: (e) => setFormMsg({ type: "err", text: e.message }),
  });

  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch<Trade>(`stocks/trades/${id}`, { method: "PUT", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades-all"] });
      setFormMsg({ type: "ok", text: "Trade updated" });
      setTimeout(() => closeDrawer(), 1200);
    },
    onError: (e) => setFormMsg({ type: "err", text: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`stocks/trades/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades-all"] });
      qc.invalidateQueries({ queryKey: ["positions"] });
      setDeleteConfirm(null);
    },
  });

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormMsg(null);
    setEditTrade(null);
    setDrawer("add");
  }

  function openEdit(t: Trade) {
    setForm({
      date: t.date.slice(0, 10),
      symbol: t.symbol,
      type: t.type,
      qty: String(t.qty),
      price: String(t.type === "sell" ? t.sellPrice : t.buyWacc),
      remarks: t.remarks ?? "",
    });
    setFormMsg(null);
    setEditTrade(t);
    setDrawer("edit");
  }

  function closeDrawer() {
    setDrawer("closed");
    setEditTrade(null);
    setFormMsg(null);
  }

  function submitForm() {
    const qty = parseInt(form.qty, 10);
    const price = parseFloat(form.price);
    if (!form.symbol || isNaN(qty) || isNaN(price) || !form.date) {
      setFormMsg({
        type: "err",
        text: "Symbol, date, qty and price are required",
      });
      return;
    }
    if (
      form.type === "sell" &&
      !sellableSymbols.includes(form.symbol.toUpperCase())
    ) {
      setFormMsg({
        type: "err",
        text: `You don't have an open position in ${form.symbol}`,
      });
      return;
    }
    const body = {
      date: form.date,
      symbol: form.symbol.toUpperCase(),
      type: form.type,
      qty,
      price,
      remarks: form.remarks,
    };
    if (drawer === "add") addMut.mutate(body);
    else if (drawer === "edit" && editTrade)
      editMut.mutate({ id: editTrade.tradeId, body });
  }

  function toggleSort(field: SortField) {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "desc" },
    );
  }

  const isPending = addMut.isPending || editMut.isPending;

  return (
    <div className="flex flex-col gap-4 pb-10 max-w-screen-2xl mx-auto w-full page-enter">
      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <StatPill
          label="Trades shown"
          value={String(filtered.length)}
          accent="primary"
        />
        <StatPill
          label="Realized P&L"
          value={formatCurrency(totalRealizedPL)}
          accent={totalRealizedPL >= 0 ? "positive" : "danger"}
          colored
        />
        <StatPill
          label="Win rate"
          value={
            sellTrades.length > 0
              ? `${((wins / sellTrades.length) * 100).toFixed(0)}%`
              : "—"
          }
          accent="warning"
        />
        <StatPill
          label="Buy turnover"
          value={formatCurrency(totalBuyTurnover)}
          accent="secondary"
        />
        <StatPill
          label="Avg hold"
          value={avgHoldDays > 0 ? `${avgHoldDays.toFixed(0)}d` : "—"}
          accent="secondary"
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 flex-1 min-w-40 max-w-64">
            <Search size={13} className="text-faint shrink-0" />
            <input
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              placeholder="Search symbol…"
              className="bg-transparent text-xs text-fg placeholder:text-faint outline-none flex-1"
            />
            {symbolFilter && (
              <button
                onClick={() => setSymbolFilter("")}
                className="text-faint hover:text-fg cursor-pointer"
              >
                <X size={11} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-0.5 bg-surface border border-border rounded-xl p-1">
            {(["all", "buy", "sell"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${typeFilter === t ? (t === "buy" ? "bg-positive/15 text-positive" : t === "sell" ? "bg-danger/15 text-danger" : "bg-primary text-bg") : "text-muted hover:text-fg"}`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border transition cursor-pointer ${showFilters || dateFrom || dateTo ? "border-primary text-primary bg-primary/10" : "border-border text-muted bg-surface hover:text-fg"}`}
          >
            <Filter size={12} /> Filters{" "}
            {(dateFrom || dateTo) && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </button>

          <div className="flex-1" />
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-bg rounded-xl text-xs font-semibold hover:bg-primary-strong transition cursor-pointer"
          >
            <Plus size={13} /> New Trade
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap p-3 bg-surface border border-border rounded-xl">
            <div className="flex items-center gap-2">
              <Calendar size={11} className="text-faint" />
              <span className="text-[10px] text-faint">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-elevated border border-border rounded-lg px-2 py-1 text-xs text-fg outline-none focus:border-primary transition"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-faint">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-elevated border border-border rounded-lg px-2 py-1 text-xs text-fg outline-none focus:border-primary transition"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-[10px] text-danger cursor-pointer flex items-center gap-1"
              >
                <X size={10} /> Clear dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mini chart */}
      {monthlyPL.length > 1 && (
        <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-2">
          <p className="text-[10px] text-faint uppercase tracking-wider">
            Monthly Realized P&L · {sellTrades.length} sell trades
          </p>
          <div style={{ height: 80 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyPL}
                margin={{ top: 2, right: 4, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 9, fill: "var(--color-faint)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(v: unknown) => [formatCurrency(Number(v)), "P&L"]}
                  contentStyle={tt}
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
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-elevated/40">
                {(
                  [
                    { field: "date", label: "Date" },
                    { field: "symbol", label: "Symbol" },
                    { field: "type", label: "Type" },
                    { field: "qty", label: "Qty" },
                    { field: "buyWacc", label: "Buy Price" },
                    { field: "sellPrice", label: "Sell Price" },
                    { field: "totalBuy", label: "Buy Total" },
                    { field: "totalSell", label: "Sell Total" },
                    { field: "netPl", label: "Net P&L" },
                    { field: "plPct", label: "P&L %" },
                    { field: "holdingDays", label: "Hold" },
                    { field: "commission", label: "Comm." },
                    { field: "remarks", label: "Remarks" },
                  ] as { field: SortField; label: string }[]
                ).map((col) => (
                  <th
                    key={col.field}
                    onClick={() => toggleSort(col.field)}
                    className="text-left text-[10px] text-faint font-medium py-3 px-3 whitespace-nowrap cursor-pointer select-none hover:text-fg transition"
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
                        <ArrowUpDown size={9} className="opacity-25" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="text-left text-[10px] text-faint font-medium py-3 px-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className="py-16 text-center text-xs text-faint"
                  >
                    No trades match your filters
                  </td>
                </tr>
              ) : (
                paginated.map((trade) => {
                  const isSell = trade.type === "sell";
                  const plPos = trade.netPl >= 0;
                  const isDeletePending = deleteConfirm === trade.tradeId;
                  return (
                    <tr
                      key={trade.tradeId}
                      className="border-b border-border/40 hover:bg-elevated/50 transition-colors group"
                    >
                      <td className="py-3 px-3 text-muted font-mono whitespace-nowrap">
                        {trade.dateStr ?? formatDate(trade.date)}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => router.push(`/stocks/${trade.symbol}`)}
                          className="font-mono font-bold text-fg hover:text-primary transition cursor-pointer"
                        >
                          {trade.symbol}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isSell ? "bg-danger/12 text-danger" : "bg-positive/12 text-positive"}`}
                        >
                          {trade.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-fg">
                        {trade.qty.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono text-muted">
                        {trade.buyWacc > 0 ? trade.buyWacc.toFixed(2) : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-muted">
                        {isSell && trade.sellPrice > 0
                          ? trade.sellPrice.toFixed(2)
                          : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-muted">
                        {trade.totalBuy > 0
                          ? formatCurrency(trade.totalBuy)
                          : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-muted">
                        {isSell && trade.totalSell > 0
                          ? formatCurrency(trade.totalSell)
                          : "—"}
                      </td>
                      <td
                        className={`py-3 px-3 font-mono font-semibold ${!isSell ? "text-faint" : plPos ? "text-positive" : "text-danger"}`}
                      >
                        {isSell
                          ? `${plPos ? "+" : ""}${formatCurrency(trade.netPl)}`
                          : "—"}
                      </td>
                      <td
                        className={`py-3 px-3 font-mono font-semibold ${!isSell ? "text-faint" : plPos ? "text-positive" : "text-danger"}`}
                      >
                        {isSell ? formatPercent(trade.plPct) : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-muted">
                        {isSell ? `${trade.holdingDays}d` : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-muted text-[10px]">
                        {trade.commission > 0
                          ? formatCurrency(trade.commission)
                          : "—"}
                      </td>
                      <td className="py-3 px-3 text-muted text-[10px] max-w-32 truncate">
                        {trade.remarks || "—"}
                      </td>
                      <td className="py-3 px-3">
                        {isDeletePending ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => deleteMut.mutate(trade.tradeId)}
                              className="text-[10px] text-danger cursor-pointer font-semibold"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-[10px] text-faint cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(trade)}
                              className="text-faint hover:text-primary transition cursor-pointer"
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(trade.tradeId)}
                              className="text-faint hover:text-danger transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-[10px] text-faint">
              {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-elevated transition cursor-pointer disabled:opacity-30"
              >
                <ChevronLeft size={13} className="text-fg" />
              </button>
              {[
                ...new Set(
                  Array.from({ length: Math.min(pageCount, 7) }).map((_, i) => {
                    if (pageCount <= 7) return i;

                    if (i === 0) return 0;
                    if (i === 6) return pageCount - 1;

                    return page - 2 + i;
                  }),
                ),
              ]
                .filter((pg) => pg >= 0 && pg < pageCount)
                .map((pg) => (
                  <button
                    key={`pg-${pg}`}
                    onClick={() => setPage(pg)}
                    className={`w-6 h-6 rounded-lg text-[10px] transition cursor-pointer ${
                      pg === page
                        ? "bg-primary text-bg font-semibold"
                        : "text-muted hover:bg-elevated"
                    }`}
                  >
                    {pg + 1}
                  </button>
                ))}
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="p-1.5 rounded-lg hover:bg-elevated transition cursor-pointer disabled:opacity-30"
              >
                <ChevronRight size={13} className="text-fg" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawer !== "closed" && (
        <TradeDrawer
          mode={drawer}
          form={form}
          setForm={setForm}
          allSymbols={allWatchlistSymbols}
          sellableSymbols={sellableSymbols}
          positions={storePositions}
          onSubmit={submitForm}
          onClose={closeDrawer}
          isPending={isPending}
          msg={formMsg}
        />
      )}
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────
type TradePreviewTuple = (string | number)[];
function parseSellPreview(p: TradePreviewTuple) {
  return {
    tradeId: p[0],
    date: p[1],
    symbol: p[2],
    type: p[3],

    qty: Number(p[4]),

    netBuyPrice: Number(p[5]),
    netBuyAmount: Number(p[6]),

    sellPrice: Number(p[7]),
    sellTotal: Number(p[8]),

    hold: Number(p[9]),
    fees: Number(p[10]),
    cgt: Number(p[11]),

    netPl: Number(p[12]),
    netPlPct: Number(p[13]),

    remark: String(p[14]),
  };
}

function PreviewCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: number | string;
  highlight?: boolean;
}) {
  if (value === undefined || value === null || value === "") return null;

  return (
    <div className="bg-surface border border-border rounded-lg p-2 flex flex-col gap-0.5">
      <span className="text-[9px] text-faint">{label}</span>
      <span
        className={`font-mono text-xs ${
          highlight ? "text-primary font-semibold" : "text-fg"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function TradeDrawer({
  mode,
  form,
  setForm,
  allSymbols,
  sellableSymbols,
  positions,
  onSubmit,
  onClose,
  isPending,
  msg,
}: {
  mode: "add" | "edit";
  form: TradeFormData;
  setForm: React.Dispatch<React.SetStateAction<TradeFormData>>;
  allSymbols: string[];
  sellableSymbols: string[];
  positions: { symbol: string; qty: number; avgBuy: number }[];
  onSubmit: () => void;
  onClose: () => void;
  isPending: boolean;
  msg: { type: "ok" | "err"; text: string } | null;
}) {
  const [previewRaw, setPreviewRaw] = useState<TradePreviewTuple | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const preview = useMemo(() => {
    if (!previewRaw) return null;
    return parseSellPreview(previewRaw);
  }, [previewRaw]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Fetch preview after qty + price settled
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    const qty = parseInt(form.qty, 10);
    const price = parseFloat(form.price);
    if (!form.symbol || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
      setPreviewRaw(null);
      return;
    }
    previewTimer.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const body = {
          symbol: form.symbol.toUpperCase(),
          type: form.type,
          qty,
          price,
          date: form.date,
        };
        const res = await apiFetch<TradePreviewResponse>(
          "stocks/trades/preview",
          { method: "POST", body },
        );
        if (res?.preview) {
          setPreviewRaw(res.preview);
        }
      } catch {
        setPreviewRaw(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 600);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [form.symbol, form.type, form.qty, form.price, form.date]);

  function field(key: keyof TradeFormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const symbolOptions = form.type === "sell" ? sellableSymbols : allSymbols;
  const currentPosition = positions.find(
    (p) => p.symbol === form.symbol.toUpperCase(),
  );
  const isSellOverQty =
    form.type === "sell" &&
    currentPosition &&
    parseInt(form.qty) > currentPosition.qty;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-bg/60 backdrop-blur-sm z-40"
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-surface border-l border-border z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-fg">
              {mode === "add" ? "Add New Trade" : "Edit Trade"}
            </h2>
            <p className="text-[10px] text-faint mt-0.5">
              {mode === "add"
                ? "Record a buy or sell transaction"
                : "Update trade details"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-elevated transition cursor-pointer text-muted hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <Label>Trade Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["buy", "sell"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => field("type", t)}
                  className={`py-3 rounded-xl text-sm font-semibold capitalize transition cursor-pointer border ${form.type === t ? (t === "buy" ? "border-positive bg-positive/15 text-positive" : "border-danger bg-danger/15 text-danger") : "border-border text-muted hover:border-fg/30"}`}
                >
                  {t === "buy" ? (
                    <TrendingUp size={14} className="inline mr-1.5 mb-0.5" />
                  ) : (
                    <TrendingDown size={14} className="inline mr-1.5 mb-0.5" />
                  )}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Symbol */}
          <div className="flex flex-col gap-1.5">
            <Label>
              Symbol{" "}
              {form.type === "sell" && (
                <span className="text-faint text-[9px]">
                  (only positions you hold)
                </span>
              )}
            </Label>
            <div className="relative">
              <input
                list="symbols-list"
                value={form.symbol}
                onChange={(e) => field("symbol", e.target.value.toUpperCase())}
                placeholder={
                  form.type === "sell"
                    ? "Select from your positions"
                    : "e.g. NABIL"
                }
                className={inputCls}
              />
              <datalist id="symbols-list">
                {symbolOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            {/* Current position info for sell */}
            {form.type === "sell" && currentPosition && (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/8 rounded-lg border border-primary/15">
                <Info size={11} className="text-primary shrink-0" />
                <span className="text-[10px] text-primary">
                  You hold {currentPosition.qty} units at avg Rs.
                  {currentPosition.avgBuy.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label>Date</Label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => field("date", e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Qty + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Quantity</Label>
              <input
                type="number"
                min="1"
                value={form.qty}
                onChange={(e) => field("qty", e.target.value)}
                placeholder="100"
                className={inputCls}
              />
              {isSellOverQty && (
                <p className="text-[10px] text-danger flex items-center gap-1">
                  <AlertCircle size={10} /> Max: {currentPosition!.qty} units
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{form.type === "buy" ? "Buy Price" : "Sell Price"}</Label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => field("price", e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>

          {/* Preview */}
          {(preview || previewLoading) && (
            <div className="bg-elevated rounded-xl p-3 border border-border/50 flex flex-col gap-1">
              <span className="text-[10px] text-faint">Preview</span>
              {previewLoading ? (
                <div className="h-4 bg-border rounded animate-pulse w-3/4" />
              ) : preview ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {form.type === "buy" ? (
                    <>
                      <PreviewCard
                        label="Net Buy Price"
                        value={preview.netBuyPrice}
                      />
                      <PreviewCard
                        label="Net Buy Amount"
                        value={preview.netBuyAmount}
                      />
                      <PreviewCard label="Fees" value={preview.fees} />
                    </>
                  ) : (
                    <>
                      <PreviewCard
                        label="Net Buy Price"
                        value={preview.netBuyPrice}
                      />
                      <PreviewCard
                        label="Net Buy Amount"
                        value={preview.netBuyAmount}
                      />
                      <PreviewCard label="Fees" value={preview.fees} />
                      <PreviewCard
                        label="Sell Amount"
                        value={preview.sellTotal}
                      />
                      <PreviewCard label="CGT" value={preview.cgt} />

                      <PreviewCard
                        label="Net P&L"
                        value={preview.netPl}
                        highlight
                      />
                      <PreviewCard
                        label="Net P&L %"
                        value={preview.netPlPct}
                        highlight
                      />
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Remarks */}
          <div className="flex flex-col gap-1.5">
            <Label>Remarks</Label>
            <textarea
              value={form.remarks}
              onChange={(e) => field("remarks", e.target.value)}
              placeholder="Optional notes…"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Message */}
          {msg && (
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${msg.type === "ok" ? "bg-positive/10 text-positive border border-positive/20" : "bg-danger/10 text-danger border border-danger/20"}`}
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

        <div className="px-6 py-5 border-t border-border flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-fg hover:border-fg/30 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isPending || !!isSellOverQty}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer disabled:opacity-50 ${form.type === "buy" ? "bg-positive text-bg hover:opacity-90" : "bg-danger text-bg hover:opacity-90"}`}
          >
            {isPending
              ? "Saving…"
              : mode === "add"
                ? "Add Trade"
                : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Small components ──────────────────────────────────────────
function StatPill({
  label,
  value,
  accent,
  colored,
}: {
  label: string;
  value: string;
  accent: string;
  colored?: boolean;
}) {
  const colorMap: Record<string, string> = {
    primary: "text-primary",
    secondary: "text-secondary",
    positive: "text-positive",
    danger: "text-danger",
    warning: "text-warning",
  };
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[9px] text-faint uppercase tracking-widest leading-none">
        {label}
      </span>
      <span
        className={`text-sm font-mono font-semibold ${colored ? (colorMap[accent] ?? "text-fg") : "text-fg"}`}
      >
        {value}
      </span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-muted font-medium">{children}</span>;
}

const inputCls =
  "w-full bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-faint outline-none focus:border-primary transition";

function today() {
  return new Date().toISOString().slice(0, 10);
}
