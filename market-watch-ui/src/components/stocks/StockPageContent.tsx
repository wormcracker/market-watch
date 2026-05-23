"use client";

import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

import type {
  SingleStockResponse,
  SummaryData,
  TradesResponse,
  WatchlistEntry,
  Position,
} from "@/lib/types";

import { StockHeader } from "@/components/stocks/StockHeader";
import { StockLiveSnapshot } from "@/components/stocks/StockLiveSnapshot";
import { StockTradesTable } from "@/components/stocks/StockTradesTable";
import { StockSummaryPanel } from "@/components/stocks/StockSummaryPanel";
import { StockOHLCBar } from "@/components/stocks/StockOHLCBar";
import { StockAlerts } from "@/components/stocks/StockAlerts";
import { StockWatchlistPanel } from "@/components/stocks/StockWatchlistPanel";
import { StockSimulator } from "@/components/stocks/StockSimulator";
import { useQueryTab } from "@/hooks/useQueryTab";

type SectionTab = "watchlist" | "summary" | "simulator";

// ─── Extracted content — accepts symbol as prop ───────────────
export function StockPageContent({ symbol }: { symbol: string }) {
  const [activeTab, setActiveTab] = useQueryTab<SectionTab>(
    ["watchlist", "summary", "simulator"],
    "watchlist",
  );

  const [
    stockRes,
    watchlistRes,
    tradesRes,
    summaryRes,
    positionRes,
    ltpWatcherRes,
    slTpWatcherRes,
  ] = useQueries({
    queries: [
      {
        queryKey: ["stock", symbol],
        queryFn: () => apiFetch<SingleStockResponse>(`nepse/stocks/${symbol}`),
      },
      {
        queryKey: ["watchlist", symbol],
        queryFn: () =>
          apiFetch<{ list: WatchlistEntry }>(`stocks/watchlist/${symbol}`),
      },
      {
        queryKey: ["trades", symbol],
        queryFn: () =>
          apiFetch<TradesResponse>(`stocks/trades?symbol=${symbol}&limit=200`),
      },
      {
        queryKey: ["summary", symbol],
        queryFn: () => apiFetch<SummaryData>(`stocks/summary?filter=${symbol}`),
        retry: false,
      },
      {
        queryKey: ["positions", symbol],
        queryFn: () => apiFetch<Position>(`stocks/positions/${symbol}`),
      },
      {
        queryKey: ["watcher-ltp", symbol],
        queryFn: () =>
          apiFetch<import("@/lib/types").Watch>(
            `watchers/watches/byName/${encodeURIComponent(`${symbol} [ltp]`)}`,
          ).catch(() => null),
        retry: false,
      },
      {
        queryKey: ["watcher-sltp", symbol],
        queryFn: () =>
          apiFetch<import("@/lib/types").Watch>(
            `watchers/watches/byName/${encodeURIComponent(`${symbol} [sl/tp]`)}`,
          ).catch(() => null),
        retry: false,
      },
    ],
  });

  const isLoading = [
    stockRes,
    watchlistRes,
    tradesRes,
    summaryRes,
    positionRes,
  ].some((r) => r.isLoading);

  const ltpWatcher = ltpWatcherRes?.data ?? null;
  const slTpWatcher = slTpWatcherRes?.data ?? null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Loading {symbol}…
      </div>
    );
  }

  const stock = stockRes.data?.stock;
  const watchlist = watchlistRes.data?.list;
  const trades = tradesRes.data?.trades ?? [];
  const summary = summaryRes.data;
  const position = positionRes.data;

  return (
    <div className="flex flex-col gap-6">
      <StockHeader symbol={symbol} watchlist={watchlist} />

      <div className="grid md:grid-cols-[300px_1fr] grid-cols-1 gap-6 items-start">
        <div className="flex flex-col gap-4 md:sticky top-4 md:order-1 order-2 max-w-75">
          {watchlist?.inPortfolio && position && (
            <StockLiveSnapshot position={position} />
          )}
          <StockOHLCBar symbol={symbol} fallback={stock} />
          <StockAlerts symbol={symbol} />
        </div>

        <div className="flex flex-col gap-4 min-w-0 md:order-2 order-1">
          <div className="rounded-xl border border-border bg-card p-1 flex gap-1 w-fit">
            <button
              onClick={() => setActiveTab("watchlist")}
              className={`px-4 py-2 text-sm rounded-lg transition ${
                activeTab === "watchlist"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Watchlist
            </button>
            <button
              onClick={() => setActiveTab("simulator")}
              className={`px-4 py-2 text-sm rounded-lg transition ${
                activeTab === "simulator"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Simulator
            </button>
            <button
              onClick={() => setActiveTab("summary")}
              className={`px-4 py-2 text-sm rounded-lg transition ${
                activeTab === "summary"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground`}
              disabled={!summary}
            >
              Summary
            </button>
          </div>

          {activeTab === "watchlist" && watchlist && (
            <div className="grid grid-cols-1 gap-4">
              <StockWatchlistPanel
                symbol={symbol}
                watchlist={watchlist}
                position={position ?? undefined}
                ltpWatcher={ltpWatcher}
                slTpWatcher={slTpWatcher}
              />
            </div>
          )}

          {activeTab === "summary" && (
            <div className="flex flex-col gap-4 max-w-7xl">
              {summary && <StockSummaryPanel summary={summary} />}
              <StockTradesTable trades={trades} />
            </div>
          )}

          {activeTab === "simulator" && watchlist && (
            <div className="flex flex-col gap-4">
              <StockSimulator
                symbol={symbol}
                watchlist={watchlist}
                position={position ?? undefined}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
