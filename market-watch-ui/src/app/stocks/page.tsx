"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPatch } from "@/lib/api";
import { useMarketStore } from "@/store/market";
import type { WatchlistEntry, Position } from "@/lib/types";
import { StockPageContent } from "@/components/stocks/StockPageContent";
import {
  Search,
  Star,
  Lock,
  X,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Zap,
  BookMarked,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  batchSyncWatchlistWatchers,
  batchSyncPortfolioWatchers,
  type BatchSyncResult,
} from "@/lib/watcher-stock-helper";

// ─── Cap label map ─────────────────────────────────────────────
const CAP_LABEL: Record<string, string> = {
  h: "Large",
  m: "Mid",
  s: "Small",
};

function isSector(e: WatchlistEntry) {
  return e.cap === "Main" || e.cap === "-";
}

// ─── Sync result toast ─────────────────────────────────────────
type SyncToast = {
  id: number;
  label: string;
  result: BatchSyncResult;
} | null;

function SyncToastBanner({
  toast,
  onClose,
}: {
  toast: SyncToast;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  const { result, label } = toast;
  const hasError = result.failed.length > 0;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 bg-surface border border-border rounded-2xl px-4 py-3 shadow-2xl min-w-72 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="mt-0.5">
        {hasError ? (
          <AlertCircle size={15} className="text-danger" />
        ) : (
          <CheckCircle size={15} className="text-positive" />
        )}
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <p className="text-xs font-semibold text-fg">{label}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {result.created.length > 0 && (
            <span className="text-[10px] text-positive">
              +{result.created.length} created
            </span>
          )}
          {result.deleted.length > 0 && (
            <span className="text-[10px] text-danger">
              −{result.deleted.length} deleted
            </span>
          )}
          {result.skipped.length > 0 && (
            <span className="text-[10px] text-muted">
              {result.skipped.length} skipped
            </span>
          )}
          {result.no_threshold.length > 0 && (
            <span className="text-[10px] text-faint">
              {result.no_threshold.length} no price data
            </span>
          )}
          {result.failed.length > 0 && (
            <span className="text-[10px] text-danger">
              {result.failed.length} failed
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-faint hover:text-fg cursor-pointer mt-0.5"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Sync progress bar ─────────────────────────────────────────
function SyncProgress({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-2.5">
      <Loader2 size={13} className="text-primary animate-spin shrink-0" />
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted">{label}</span>
          <span className="text-[10px] font-mono text-faint">
            {done}/{total}
          </span>
        </div>
        <div className="h-1 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export default function WatchlistPage() {
  return (
    <Suspense>
      <WatchlistPageInner />
    </Suspense>
  );
}

function WatchlistPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const prices = useMarketStore((s) => s.prices);

  // ── Filter state from URL ────────────────────────────────────
  const search = searchParams.get("search") ?? "";
  const capFilter = (searchParams.get("cap") ?? "all") as
    | "all"
    | "h"
    | "m"
    | "s";
  const pctFilter = (searchParams.get("pct") ?? "all") as
    | "all"
    | "positive"
    | "negative";
  const sectorFilter = searchParams.get("sector") ?? "all";
  const showWatchOnly = searchParams.get("watch") === "1";
  const showPortfolioOnly = searchParams.get("portfolio") === "1";
  const showLockedOnly = searchParams.get("locked") === "1";

  const pushParam = useCallback(
    (overrides: Record<string, string | boolean | null>) => {
      const p = new URLSearchParams();

      for (const [k, v] of Object.entries(overrides)) {
        if (v === null || v === "" || v === false || v === "all") continue;

        if (v === true) {
          p.set(k, "1");
        } else {
          p.set(k, String(v));
        }
      }

      router.replace(
        p.toString() ? `?${p.toString()}` : window.location.pathname,
        { scroll: false },
      );
    },
    [router],
  );

  // ── Modal state ───────────────────────────────────────────────
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  // ── Selection state ───────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // ── Sync state ────────────────────────────────────────────────
  const [syncingWatchlist, setSyncingWatchlist] = useState(false);
  const [syncingPortfolio, setSyncingPortfolio] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
  const [syncToast, setSyncToast] = useState<SyncToast>(null);
  const toastIdRef = useRef(0);

  // ── Fetch ─────────────────────────────────────────────────────
  const { data: raw, isLoading } = useQuery<{
    stocks: WatchlistEntry[];
    total: number;
  }>({
    queryKey: ["watchlist"],
    queryFn: () =>
      apiFetch<{ stocks: WatchlistEntry[]; total: number }>("stocks/watchlist"),
    staleTime: 60_000,
  });

  const allStocks: WatchlistEntry[] = raw?.stocks ?? [];

  // ── Optimistic watch state ─────────────────────────────────────
  const [optimisticWatch, setOptimisticWatch] = useState<
    Record<string, boolean>
  >({});

  // ── Watch mutation ─────────────────────────────────────────────
  const watchMut = useMutation({
    mutationFn: ({ symbol, watch }: { symbol: string; watch: boolean }) =>
      apiPatch(`stocks/watchlist/${symbol}`, { watch }),
    onMutate: ({ symbol, watch }) => {
      setOptimisticWatch((prev) => ({ ...prev, [symbol]: watch }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (_, { symbol }) => {
      setOptimisticWatch((prev) => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    },
    onSettled: (_, __, { symbol }) => {
      setTimeout(() => {
        setOptimisticWatch((prev) => {
          const next = { ...prev };
          delete next[symbol];
          return next;
        });
      }, 2000);
    },
  });

  function isWatched(e: WatchlistEntry) {
    return optimisticWatch[e.symbol] !== undefined
      ? optimisticWatch[e.symbol]
      : e.watch;
  }

  function toggleWatch(e: WatchlistEntry, ev: React.MouseEvent) {
    ev.stopPropagation();
    watchMut.mutate({ symbol: e.symbol, watch: !isWatched(e) });
  }

  // ── Sector map ────────────────────────────────────────────────
  const { sectors, stocksBySector } = useMemo(() => {
    const sectors: string[] = [];
    const stocksBySector: Record<string, WatchlistEntry[]> = {};
    let currentSector = "Unknown";

    for (const e of allStocks) {
      if (isSector(e)) {
        currentSector = e.symbol;
        sectors.push(currentSector);
        stocksBySector[currentSector] = [];
      } else {
        if (!stocksBySector[currentSector]) {
          stocksBySector[currentSector] = [];
          sectors.push(currentSector);
        }
        stocksBySector[currentSector].push(e);
      }
    }
    return { sectors, stocksBySector };
  }, [allStocks]);

  const flatStocks = useMemo(
    () => allStocks.filter((e) => !isSector(e)),
    [allStocks],
  );

  const sectorNames = useMemo(
    () => sectors.filter((s) => stocksBySector[s]?.length > 0),
    [sectors, stocksBySector],
  );

  // ── Filtered data ─────────────────────────────────────────────
  const filteredBySector = useMemo(() => {
    const result: Record<string, WatchlistEntry[]> = {};
    for (const sector of sectorNames) {
      const stocks = (stocksBySector[sector] ?? []).filter((e) => {
        const currentPct = prices[e.symbol]?.percentChange ?? e.chgPct;
        if (
          search &&
          !e.symbol.toLowerCase().includes(search.toLowerCase()) &&
          !e.remark.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        if (capFilter !== "all" && e.cap !== capFilter) return false;
        if (showWatchOnly && !isWatched(e)) return false;
        if (showPortfolioOnly && !e.inPortfolio) return false;
        if (showLockedOnly && !e.isLocked) return false;
        if (pctFilter === "positive" && currentPct < 0) return false;
        if (pctFilter === "negative" && currentPct >= 0) return false;
        return true;
      });
      if (sectorFilter !== "all" && sector !== sectorFilter) continue;
      if (stocks.length > 0) result[sector] = stocks;
    }
    return result;
  }, [
    sectorNames,
    stocksBySector,
    search,
    capFilter,
    showWatchOnly,
    showPortfolioOnly,
    showLockedOnly,
    sectorFilter,
    optimisticWatch,
    pctFilter,
    prices,
  ]);

  const flatFilteredStocks = useMemo(
    () => Object.values(filteredBySector).flat(),
    [filteredBySector],
  );

  const visibleSectors = Object.keys(filteredBySector);
  const totalVisible = visibleSectors.reduce(
    (s, k) => s + filteredBySector[k].length,
    0,
  );
  const watchedCount = flatStocks.filter((e) => isWatched(e)).length;
  const portfolioCount = flatStocks.filter((e) => e.inPortfolio).length;
  const lockedCount = flatStocks.filter((e) => e.isLocked).length;
  const activeFilterCount = [
    capFilter !== "all",
    sectorFilter !== "all",
    showWatchOnly,
    showPortfolioOnly,
    showLockedOnly,
    pctFilter !== "all",
    !!search,
  ].filter(Boolean).length;

  // ── Collapsed sectors ─────────────────────────────────────────
  const [collapsedSectors, setCollapsedSectors] = useState<Set<string>>(
    new Set(),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  function toggleSector(name: string) {
    setCollapsedSectors((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function clearFilters() {
    router.replace(window.location.pathname, { scroll: false });
  }

  // ── Modal helpers ─────────────────────────────────────────────
  const modalEntry =
    modalIndex !== null ? (flatFilteredStocks[modalIndex] ?? null) : null;

  useEffect(() => {
    if (modalIndex !== null && modalIndex >= flatFilteredStocks.length) {
      const clamped = flatFilteredStocks.length - 1;
      setModalIndex(clamped >= 0 ? clamped : null);
    }
  }, [flatFilteredStocks.length]);

  function modalNext() {
    setModalIndex((i) =>
      i === null ? 0 : Math.min(flatFilteredStocks.length - 1, i + 1),
    );
  }

  function modalPrev() {
    setModalIndex((i) => (i === null ? 0 : Math.max(0, i - 1)));
  }

  // ── Selection helpers ─────────────────────────────────────────
  function toggleSelect(symbol: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(symbol) ? next.delete(symbol) : next.add(symbol);
      return next;
    });
  }

  function bulkWatch(watch: boolean) {
    selected.forEach((symbol) => watchMut.mutate({ symbol, watch }));
    setSelected(new Set());
  }

  function invertSelection() {
    const next = new Set<string>();
    flatFilteredStocks.forEach((e) => {
      if (!selected.has(e.symbol)) next.add(e.symbol);
    });
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(flatFilteredStocks.map((e) => e.symbol)));
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectMode(false);
  }

  // ── Sync: Button A — Watchlist watchers ───────────────────────
  async function handleSyncWatchlist() {
    if (syncingWatchlist || flatStocks.length === 0) return;
    setSyncingWatchlist(true);
    setSyncProgress({ done: 0, total: flatStocks.length });

    try {
      const result = await batchSyncWatchlistWatchers(
        flatStocks,
        (done, total) => setSyncProgress({ done, total }),
      );
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      toastIdRef.current++;
      setSyncToast({
        id: toastIdRef.current,
        label: "Watchlist watchers synced",
        result,
      });
    } finally {
      setSyncingWatchlist(false);
      setSyncProgress({ done: 0, total: 0 });
    }
  }

  // ── Sync: Button B — Portfolio watchers ───────────────────────
  async function handleSyncPortfolio() {
    if (syncingPortfolio) return;
    setSyncingPortfolio(true);

    try {
      // Fresh fetch at click time — don't rely on stale store
      const raw = await apiFetch<unknown>("stocks/positions");
      let positions: Position[] = [];
      if (Array.isArray(raw)) positions = raw as Position[];
      else if (raw && typeof raw === "object") {
        const o = raw as Record<string, unknown>;
        if (Array.isArray(o.positions)) positions = o.positions as Position[];
        else positions = Object.values(o) as Position[];
      }

      // Only in-portfolio stocks that also exist in our watchlist data
      const portfolioSymbols = new Set(positions.map((p) => p.symbol));
      const portfolioWatchlist = flatStocks.filter(
        (s) => s.inPortfolio && portfolioSymbols.has(s.symbol),
      );

      const pairs = portfolioWatchlist.flatMap((wl) => {
        const pos = positions.find((p) => p.symbol === wl.symbol);
        if (!pos) return [];
        return [{ watchlist: wl, position: pos }];
      });

      setSyncProgress({ done: 0, total: pairs.length });

      const result = await batchSyncPortfolioWatchers(pairs, (done, total) =>
        setSyncProgress({ done, total }),
      );

      toastIdRef.current++;
      setSyncToast({
        id: toastIdRef.current,
        label: "Portfolio SL/TP watchers synced",
        result,
      });
    } finally {
      setSyncingPortfolio(false);
      setSyncProgress({ done: 0, total: 0 });
    }
  }

  const isSyncing = syncingWatchlist || syncingPortfolio;

  // ── Keyboard shortcuts ─────────────────────────────────────────
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (modalIndex !== null) {
        if (e.key === "n" || e.key === "ArrowRight") {
          e.preventDefault();
          modalNext();
          return;
        }
        if (e.key === "b" || e.key === "ArrowLeft") {
          e.preventDefault();
          modalPrev();
          return;
        }
        if (e.key === "Escape") {
          setModalIndex(null);
          return;
        }
        return;
      }

      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (
        e.key === "Escape" &&
        document.activeElement === searchInputRef.current
      ) {
        searchInputRef.current?.blur();
        return;
      }

      if (isTyping) return;

      if (e.key === "t") pushParam({ watch: !showWatchOnly });
      else if (e.key === "p") pushParam({ portfolio: !showPortfolioOnly });
      else if (e.key === "l") pushParam({ locked: !showLockedOnly });
      else if (e.key === "w") {
        const next =
          pctFilter === "all"
            ? "positive"
            : pctFilter === "positive"
              ? "negative"
              : "all";
        pushParam({ pct: next });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    modalIndex,
    showWatchOnly,
    showPortfolioOnly,
    showLockedOnly,
    pctFilter,
    pushParam,
    flatFilteredStocks.length,
  ]);

  useEffect(() => {
    document.body.style.overflow = modalIndex !== null ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalIndex]);

  function handleCardClick(entry: WatchlistEntry, flatIndex: number) {
    if (selectMode) {
      toggleSelect(entry.symbol);
      return;
    }
    setModalIndex(flatIndex);
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col gap-4 pb-10 max-w-screen-2xl mx-auto w-full">
        {/* ── Header strip ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatChip label="Total" value={totalVisible} />
            <StatChip
              label="Watched"
              value={watchedCount}
              accent="warning"
              onClick={() => pushParam({ watch: !showWatchOnly })}
              active={showWatchOnly}
              shortcut="T"
            />
            <StatChip
              label="Portfolio"
              value={portfolioCount}
              accent="positive"
              onClick={() => pushParam({ portfolio: !showPortfolioOnly })}
              active={showPortfolioOnly}
              shortcut="P"
            />
            <StatChip
              label="Locked"
              value={lockedCount}
              accent="primary"
              onClick={() => pushParam({ locked: !showLockedOnly })}
              active={showLockedOnly}
              shortcut="L"
            />
          </div>

          <div className="flex-1" />

          {/* Sentiment filter */}
          <div className="flex items-center gap-0.5 bg-surface border border-border rounded-xl p-1">
            {(
              [
                { key: "all", label: "All", color: "" },
                { key: "positive", label: "▲ Pos", color: "text-positive" },
                { key: "negative", label: "▼ Neg", color: "text-danger" },
              ] as {
                key: "all" | "positive" | "negative";
                label: string;
                color: string;
              }[]
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => pushParam({ pct: item.key })}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                  pctFilter === item.key
                    ? "bg-primary text-bg"
                    : `${item.color || "text-muted"} hover:text-fg hover:bg-elevated`
                }`}
              >
                {item.label}
              </button>
            ))}
            <span className="ml-1 mr-0.5 text-[9px] text-faint border border-border/50 rounded px-1 py-0.5 font-mono select-none">
              W
            </span>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 w-52 focus-within:border-primary/50 transition-colors">
            <Search size={13} className="text-faint shrink-0" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => pushParam({ search: e.target.value || null })}
              placeholder="Search symbol…"
              className="bg-transparent text-xs text-fg outline-none flex-1"
            />
            {search ? (
              <button
                onClick={() => pushParam({ search: null })}
                className="text-faint hover:text-fg cursor-pointer p-0.5"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <line
                    x1="1"
                    y1="1"
                    x2="13"
                    y2="13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="13"
                    y1="1"
                    x2="1"
                    y2="13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : (
              <span className="text-[9px] text-faint border border-border/50 rounded px-1 py-0.5 font-mono select-none">
                /
              </span>
            )}
          </div>

          {/* Select mode toggle */}
          <button
            onClick={() => {
              if (selectMode) clearSelection();
              else setSelectMode(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border cursor-pointer transition-colors ${
              selectMode
                ? "border-primary/40 text-primary bg-primary/10"
                : "border-border text-muted hover:text-fg"
            }`}
          >
            {selectMode ? <CheckSquare size={12} /> : <Square size={12} />}
            Select
          </button>

          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border cursor-pointer transition-colors ${
              activeFilterCount > 0
                ? "border-primary/40 text-primary bg-primary/10"
                : "border-border text-muted hover:text-fg"
            }`}
          >
            <SlidersHorizontal size={12} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-primary text-bg text-[9px] font-bold px-1 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Watcher Sync Buttons ─────────────────────────────── */}
        {/* Lives behind the filter bar — two action buttons for batch watcher management */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Button A: Sync watchlist watchers */}
          <button
            onClick={handleSyncWatchlist}
            disabled={isSyncing || isLoading || flatStocks.length === 0}
            title="For each watched stock: create [ltp] watcher if missing. For each unwatched: delete it."
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              syncingWatchlist
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-border bg-surface text-muted hover:text-warning hover:border-warning/40 hover:bg-warning/8"
            }`}
          >
            {syncingWatchlist ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Star size={12} />
            )}
            Sync Watchlist Watchers
            <span className="text-[9px] font-mono opacity-50 border border-current/30 rounded px-1 py-0.5">
              {watchedCount} watched
            </span>
          </button>

          {/* Button B: Sync portfolio SL/TP watchers */}
          <button
            onClick={handleSyncPortfolio}
            disabled={isSyncing || isLoading || portfolioCount === 0}
            title="For each portfolio stock: create [sl/tp] watcher if not already created. Uses stored SL/TP or WACC ±%."
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              syncingPortfolio
                ? "border-positive/40 bg-positive/10 text-positive"
                : "border-border bg-surface text-muted hover:text-positive hover:border-positive/40 hover:bg-positive/8"
            }`}
          >
            {syncingPortfolio ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <BookMarked size={12} />
            )}
            Sync Portfolio Watchers
            <span className="text-[9px] font-mono opacity-50 border border-current/30 rounded px-1 py-0.5">
              {portfolioCount} held
            </span>
          </button>

          {/* Progress bar — shown while syncing */}
          {isSyncing && syncProgress.total > 0 && (
            <div className="flex-1 min-w-48">
              <SyncProgress
                done={syncProgress.done}
                total={syncProgress.total}
                label={
                  syncingWatchlist
                    ? "Syncing watchlist watchers…"
                    : "Syncing portfolio watchers…"
                }
              />
            </div>
          )}
        </div>

        {/* ── Bulk action bar ──────────────────────────────────── */}
        {selectMode && (
          <div className="flex items-center gap-2 bg-surface border border-border rounded-2xl px-4 py-2.5 flex-wrap">
            <span className="text-xs text-muted shrink-0">
              {selected.size > 0
                ? `${selected.size} selected`
                : "None selected"}
            </span>
            <div className="flex-1" />
            <button
              onClick={selectAll}
              className="text-[11px] text-muted hover:text-fg border border-border rounded-lg px-2.5 py-1 cursor-pointer transition-colors"
            >
              All ({totalVisible})
            </button>
            <button
              onClick={invertSelection}
              className="text-[11px] text-muted hover:text-fg border border-border rounded-lg px-2.5 py-1 cursor-pointer transition-colors"
            >
              Invert
            </button>
            <div className="w-px h-4 bg-border shrink-0" />
            <button
              onClick={() => bulkWatch(true)}
              disabled={selected.size === 0}
              className="text-[11px] text-warning bg-warning/10 border border-warning/30 rounded-lg px-2.5 py-1 cursor-pointer disabled:opacity-40 transition-colors hover:bg-warning/20"
            >
              ★ Watch
            </button>
            <button
              onClick={() => bulkWatch(false)}
              disabled={selected.size === 0}
              className="text-[11px] text-muted border border-border rounded-lg px-2.5 py-1 cursor-pointer disabled:opacity-40 transition-colors hover:text-fg"
            >
              Unwatch
            </button>
            <button
              onClick={clearSelection}
              className="text-[11px] text-danger/70 hover:text-danger border border-border rounded-lg px-2.5 py-1 cursor-pointer transition-colors flex items-center gap-1"
            >
              <X size={10} />
              Done
            </button>
          </div>
        )}

        {/* ── Filter panel ─────────────────────────────────────── */}
        {filtersOpen && (
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-fg">Filters</p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-[10px] text-danger hover:text-danger/80 cursor-pointer flex items-center gap-1"
                >
                  <X size={10} /> Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] text-faint uppercase tracking-wide">
                  Market Cap
                </p>
                <div className="flex gap-1 flex-wrap">
                  {(["all", "h", "m", "s"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => pushParam({ cap: c })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                        capFilter === c
                          ? "bg-primary text-bg"
                          : "bg-elevated text-muted hover:text-fg"
                      }`}
                    >
                      {c === "all" ? "All" : CAP_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] text-faint uppercase tracking-wide">
                  Sector
                </p>
                <select
                  value={sectorFilter}
                  onChange={(e) => pushParam({ sector: e.target.value })}
                  className="bg-elevated border border-border rounded-lg px-2 py-1 text-xs text-fg outline-none cursor-pointer"
                >
                  <option value="all">All Sectors</option>
                  {sectorNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] text-faint uppercase tracking-wide">
                  % Change
                </p>
                <div className="flex gap-1 flex-wrap">
                  {[
                    { key: "all", label: "All" },
                    { key: "positive", label: "Positive" },
                    { key: "negative", label: "Negative" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => pushParam({ pct: item.key })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                        pctFilter === item.key
                          ? "bg-primary text-bg"
                          : "bg-elevated text-muted hover:text-fg"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <p className="text-[10px] text-faint uppercase tracking-wide">
                  Quick Filters
                </p>
                <div className="flex gap-2 flex-wrap">
                  <ToggleChip
                    label="Watchlist only"
                    active={showWatchOnly}
                    onClick={() => pushParam({ watch: !showWatchOnly })}
                    shortcut="T"
                  />
                  <ToggleChip
                    label="In portfolio"
                    active={showPortfolioOnly}
                    onClick={() => pushParam({ portfolio: !showPortfolioOnly })}
                    shortcut="P"
                  />
                  <ToggleChip
                    label="Locked"
                    active={showLockedOnly}
                    onClick={() => pushParam({ locked: !showLockedOnly })}
                    shortcut="L"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-36 bg-surface rounded-2xl border border-border animate-pulse"
              />
            ))}
          </div>
        ) : visibleSectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <Eye size={28} className="text-faint" />
            <p className="text-sm text-faint">No stocks match your filters</p>
            <button
              onClick={clearFilters}
              className="text-xs text-primary hover:text-primary-strong cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {visibleSectors.map((sector) => {
              const stocks = filteredBySector[sector];
              const isCollapsed = collapsedSectors.has(sector);
              const sectorEntry = allStocks.find(
                (e) => e.symbol === sector && isSector(e),
              );
              const sectorWatched = stocks.filter((e) => isWatched(e)).length;
              const sectorInPortfolio = stocks.filter(
                (e) => e.inPortfolio,
              ).length;

              return (
                <div key={sector} className="flex flex-col gap-3">
                  <button
                    onClick={() => toggleSector(sector)}
                    className="flex items-center gap-3 group cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold text-fg uppercase tracking-wider truncate">
                        {sector}
                      </span>
                      {sectorEntry?.remark && (
                        <span className="text-[10px] text-faint border border-border/60 px-2 py-0.5 rounded-full truncate max-w-48">
                          {sectorEntry.remark}
                        </span>
                      )}
                      <span className="text-[10px] text-faint bg-elevated px-2 py-0.5 rounded-full shrink-0">
                        {stocks.length}
                      </span>
                      {sectorWatched > 0 && (
                        <span className="text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded-full shrink-0">
                          ★ {sectorWatched}
                        </span>
                      )}
                      {sectorInPortfolio > 0 && (
                        <span className="text-[10px] text-positive bg-positive/10 px-2 py-0.5 rounded-full shrink-0">
                          ⬤ {sectorInPortfolio}
                        </span>
                      )}
                    </div>
                    <span className="text-faint group-hover:text-fg transition shrink-0">
                      {isCollapsed ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronUp size={14} />
                      )}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {stocks.map((entry) => {
                        const flatIndex = flatFilteredStocks.findIndex(
                          (e) => e.symbol === entry.symbol,
                        );
                        return (
                          <StockCard
                            key={entry.symbol}
                            entry={entry}
                            livePrice={prices[entry.symbol]}
                            watched={isWatched(entry)}
                            onToggleWatch={(ev) => toggleWatch(entry, ev)}
                            onClick={() => handleCardClick(entry, flatIndex)}
                            isOptimistic={
                              optimisticWatch[entry.symbol] !== undefined
                            }
                            selectMode={selectMode}
                            selected={selected.has(entry.symbol)}
                            onToggleSelect={() => toggleSelect(entry.symbol)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Stock Modal ───────────────────────────────────────────── */}
      {modalIndex !== null && modalEntry && (
        <StockModal
          entry={modalEntry}
          index={modalIndex}
          total={flatFilteredStocks.length}
          onClose={() => setModalIndex(null)}
          onPrev={modalPrev}
          onNext={modalNext}
          livePrice={prices[modalEntry.symbol]}
          watched={isWatched(modalEntry)}
          onToggleWatch={(ev) => toggleWatch(modalEntry, ev)}
          onOpenFullPage={() => router.push(`/stocks/${modalEntry.symbol}`)}
        />
      )}

      {/* ── Sync result toast ─────────────────────────────────────── */}
      <SyncToastBanner toast={syncToast} onClose={() => setSyncToast(null)} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  STOCK MODAL
// ─────────────────────────────────────────────────────────────
function StockModal({
  entry,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  livePrice,
  watched,
  onToggleWatch,
  onOpenFullPage,
}: {
  entry: WatchlistEntry;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  livePrice: { ltp: number; percentChange: number } | undefined;
  watched: boolean;
  onToggleWatch: (e: React.MouseEvent) => void;
  onOpenFullPage: () => void;
}) {
  const ltp = livePrice?.ltp ?? entry.ltp;
  const chgPct = livePrice?.percentChange ?? entry.chgPct;
  const isUp = chgPct >= 0;
  const isLive = !!livePrice;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      style={{
        backgroundColor: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        disabled={!canPrev}
        className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
          canPrev
            ? "bg-surface/90 border-border text-fg hover:bg-elevated hover:border-primary/40 cursor-pointer"
            : "opacity-20 border-border bg-surface/50 text-faint cursor-not-allowed"
        }`}
        title="Previous  B / ←"
      >
        <ChevronLeft size={17} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        disabled={!canNext}
        className={`absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
          canNext
            ? "bg-surface/90 border-border text-fg hover:bg-elevated hover:border-primary/40 cursor-pointer"
            : "opacity-20 border-border bg-surface/50 text-faint cursor-not-allowed"
        }`}
        title="Next  N / →"
      >
        <ChevronRight size={17} />
      </button>

      <div
        className="
    fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
    bg-bg border border-border rounded-3xl flex flex-col overflow-hidden shadow-2xl
    w-[90vw] h-[90vh]
    
    sm:w-[90vw] sm:h-[90vh]

    max-sm:fixed
    max-sm:left-0
    max-sm:right-0
    max-sm:bottom-0
    max-sm:top-auto
    max-sm:translate-x-0
    max-sm:translate-y-0
    max-sm:w-full
    max-sm:h-[80vh]
    max-sm:rounded-t-3xl
    max-sm:rounded-b-none
    max-sm:animate-slideUp
  "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border shrink-0 flex-wrap">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-lg font-bold font-mono text-fg">
              {entry.symbol}
            </span>

            {entry.cap && entry.cap !== "-" && entry.cap !== "Main" && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${
                  entry.cap === "h"
                    ? "bg-primary/15 text-primary"
                    : entry.cap === "m"
                      ? "bg-secondary/15 text-secondary"
                      : "bg-warning/15 text-warning"
                }`}
              >
                {CAP_LABEL[entry.cap] ?? entry.cap}
              </span>
            )}

            {entry.inPortfolio && (
              <span className="text-[9px] bg-positive/15 text-positive px-1.5 py-0.5 rounded-md font-semibold shrink-0">
                {entry.heldQty > 0 ? `×${entry.heldQty}` : "Held"}
              </span>
            )}

            {entry.remark && (
              <span className="text-[10px] text-faint border border-border/60 px-2 py-0.5 rounded-full truncate max-w-64 hidden sm:inline">
                {entry.remark}
              </span>
            )}
          </div>

          {ltp > 0 && (
            <div className="flex items-baseline gap-2 shrink-0">
              <span
                className={`text-xl font-mono font-bold ${isLive ? "text-fg" : "text-muted"}`}
              >
                {ltp.toFixed(1)}
              </span>
              <span
                className={`text-sm font-mono font-semibold flex items-center gap-0.5 ${isUp ? "text-positive" : "text-danger"}`}
              >
                {isUp ? (
                  <ArrowUpRight size={13} />
                ) : (
                  <ArrowDownRight size={13} />
                )}
                {isUp ? "+" : ""}
                {chgPct.toFixed(2)}%
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggleWatch}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                watched
                  ? "bg-warning/20 border-warning/40 text-warning"
                  : "bg-elevated border-border text-faint hover:text-warning hover:border-warning/30"
              }`}
              title={watched ? "Unwatch" : "Watch"}
            >
              <Star size={13} className={watched ? "fill-warning" : ""} />
            </button>

            <button
              onClick={onOpenFullPage}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] border border-border bg-elevated text-muted hover:text-fg hover:border-primary/30 cursor-pointer transition-colors"
              title="Open full page"
            >
              <ArrowUpRight size={11} />
              Full page
            </button>

            <button
              onClick={onClose}
              className="md:flex hidden w-8 h-8 rounded-xl items-center justify-center bg-elevated border border-border text-muted hover:text-fg cursor-pointer transition-colors"
              title="Close  Esc"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StockPageContent key={entry.symbol} symbol={entry.symbol} />
        </div>

        <div className="flex items-center justify-between px-6 py-2 border-t border-border shrink-0 bg-elevated/30">
          <span className="text-[10px] text-faint font-mono tabular-nums">
            {index + 1} / {total}
          </span>
          <div className="md:flex hidden items-center gap-4 text-[10px] text-faint">
            <span className="flex items-center gap-1">
              <Kbd>B</Kbd>
              <Kbd>←</Kbd> prev
            </span>
            <span className="flex items-center gap-1">
              next <Kbd>N</Kbd>
              <Kbd>→</Kbd>
            </span>
            <span className="flex items-center gap-1">
              close <Kbd>Esc</Kbd>
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex md:hidden items-center justify-center bg-elevated border border-border text-muted hover:text-fg cursor-pointer transition-colors"
            title="Close  Esc"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  STOCK CARD
// ─────────────────────────────────────────────────────────────
function StockCard({
  entry,
  livePrice,
  watched,
  onToggleWatch,
  onClick,
  isOptimistic,
  selectMode,
  selected,
  onToggleSelect,
}: {
  entry: WatchlistEntry;
  livePrice: { ltp: number; percentChange: number } | undefined;
  watched: boolean;
  onToggleWatch: (e: React.MouseEvent) => void;
  onClick: () => void;
  isOptimistic: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const ltp = livePrice?.ltp ?? entry.ltp;
  const chgPct = livePrice?.percentChange ?? entry.chgPct;
  const hasPrice = ltp > 0;
  const isUp = chgPct >= 0;
  const isLive = !!livePrice;

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-surface border rounded-2xl p-4 flex flex-col gap-3 cursor-pointer
        hover:border-primary/40 hover:bg-elevated/60 hover:shadow-lg
        transition-all duration-200 group overflow-hidden
        ${
          selected
            ? "border-primary/50 ring-1 ring-primary/20 bg-primary/5"
            : watched
              ? "border-warning/30"
              : "border-border"
        }
        ${entry.inPortfolio && !selected ? "ring-1 ring-positive/20" : ""}
      `}
    >
      {watched && !selected && (
        <div className="absolute inset-0 bg-gradient-to-br from-warning/4 via-transparent to-transparent pointer-events-none rounded-2xl" />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold font-mono text-fg group-hover:text-primary transition truncate">
              {entry.symbol}
            </span>
            {entry.cap && entry.cap !== "-" && entry.cap !== "Main" && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${
                  entry.cap === "h"
                    ? "bg-primary/15 text-primary"
                    : entry.cap === "m"
                      ? "bg-secondary/15 text-secondary"
                      : "bg-warning/15 text-warning"
                }`}
              >
                {CAP_LABEL[entry.cap] ?? entry.cap}
              </span>
            )}
            {entry.inPortfolio && (
              <span className="text-[9px] bg-positive/15 text-positive px-1.5 py-0.5 rounded-md font-semibold shrink-0">
                {entry.heldQty > 0 ? `×${entry.heldQty}` : "Held"}
              </span>
            )}
          </div>
          {entry.isLocked && (
            <span className="flex items-center gap-0.5 text-[9px] text-primary bg-primary/10 w-fit px-1.5 py-0.5 rounded-md">
              <Lock size={8} />
              {entry.unlockIn}
            </span>
          )}
          {!entry.isLocked && entry.unlockIn && (
            <span className="text-[9px] text-faint">{entry.unlockIn}</span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatch(e);
          }}
          className={`
            shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
            transition-all duration-200 cursor-pointer border
            ${
              watched
                ? "bg-warning/20 border-warning/40 text-warning shadow-[0_0_8px_rgba(var(--color-warning-rgb),0.3)]"
                : "bg-elevated border-border text-faint hover:text-warning hover:border-warning/30 hover:bg-warning/10"
            }
            ${isOptimistic ? "scale-110" : ""}
          `}
          title={watched ? "Remove from watchlist" : "Add to watchlist"}
        >
          <Star
            size={14}
            className={`transition-all duration-200 ${watched ? "fill-warning" : ""}`}
          />
        </button>
      </div>

      {hasPrice ? (
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-lg font-mono font-bold ${isLive ? "text-fg" : "text-muted"}`}
              >
                {ltp.toFixed(1)}
              </span>
            </div>
            <div
              className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${isUp ? "text-positive" : "text-danger"}`}
            >
              {isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {isUp ? "+" : ""}
              {chgPct.toFixed(2)}%
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] text-faint font-mono">
              H {entry.high > 0 ? entry.high.toFixed(1) : "—"}
            </span>
            <span className="text-[9px] text-faint font-mono">
              L {entry.low > 0 ? entry.low.toFixed(1) : "—"}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-faint italic">No price data</div>
      )}

      <MessageBadge
        entry={entry}
        onSave={async (msg) => {
          try {
            await fetch(`/api/proxy/stocks/watchlist/${entry.symbol}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: msg }),
            });
          } catch {}
        }}
      />

      {!selectMode && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowUpRight size={12} className="text-primary" />
        </div>
      )}

      <div
        className={`absolute bottom-3 left-3 transition-opacity duration-150 ${
          selectMode ? "opacity-100" : "opacity-0 group-hover:opacity-50"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
      >
        <div
          className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-all cursor-pointer ${
            selected
              ? "bg-primary border-primary shadow-[0_0_0_2px_rgba(var(--color-primary-rgb),0.25)]"
              : "bg-bg/80 border-border hover:border-primary/60 backdrop-blur-sm"
          }`}
        >
          {selected && (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <polyline
                points="1.2,4.5 3.5,7 7.5,1.5"
                stroke="white"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────

function MessageBadge({
  entry,
  onSave,
}: {
  entry: WatchlistEntry;
  onSave: (msg: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(entry.message ?? "");
  const [saving, setSaving] = useState(false);

  const msg = entry.message;
  const badgeColor = !msg
    ? "bg-primary/15 text-primary"
    : msg.toLowerCase().includes("sell")
      ? "bg-danger/15 text-danger"
      : msg.toLowerCase().includes("warn") ||
          msg.toLowerCase().includes("caution")
        ? "bg-warning/15 text-warning"
        : "bg-primary/15 text-primary";

  if (editing) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              setSaving(true);
              await onSave(val);
              setSaving(false);
              setEditing(false);
            } else if (e.key === "Escape") {
              setVal(entry.message ?? "");
              setEditing(false);
            }
          }}
          placeholder="Add message…"
          className="flex-1 bg-elevated border border-primary rounded-lg px-2 py-0.5 text-[10px] text-fg outline-none min-w-0"
        />
        <button
          onClick={async (e) => {
            e.stopPropagation();
            setSaving(true);
            await onSave(val);
            setSaving(false);
            setEditing(false);
          }}
          disabled={saving}
          className="text-[9px] text-primary font-semibold cursor-pointer disabled:opacity-50"
        >
          {saving ? "…" : "✓"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditing(false);
          }}
          className="text-[9px] text-faint cursor-pointer"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group/msg">
      {msg ? (
        <span
          className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}
        >
          {msg}
        </span>
      ) : (
        <span className="text-[9px] text-faint opacity-0 group-hover/msg:opacity-100 transition-opacity">
          + message
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setVal(entry.message ?? "");
          setEditing(true);
        }}
        className="opacity-0 group-hover/msg:opacity-100 transition-opacity cursor-pointer p-0.5 rounded text-faint hover:text-fg"
      >
        <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 10.5V12h1.5l4.87-4.87-1.5-1.5L2 10.5zM11.71 3.04a1 1 0 000-1.41L10.37.29a1 1 0 00-1.41 0L8 1.25l2.5 2.5.21-.21z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}

function StatChip({
  label,
  value,
  accent,
  onClick,
  active,
  shortcut,
}: {
  label: string;
  value: number;
  accent?: string;
  onClick?: () => void;
  active?: boolean;
  shortcut?: string;
}) {
  const accentMap: Record<string, string> = {
    warning: active
      ? "bg-warning/20 text-warning border-warning/30"
      : "bg-surface border-border text-muted hover:border-warning/30 hover:text-warning",
    positive: active
      ? "bg-positive/20 text-positive border-positive/30"
      : "bg-surface border-border text-muted hover:border-positive/30 hover:text-positive",
    primary: active
      ? "bg-primary/20 text-primary border-primary/30"
      : "bg-surface border-border text-muted hover:border-primary/30 hover:text-primary",
  };
  const cls = accentMap[accent ?? ""] ?? "bg-surface border-border text-muted";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition cursor-pointer ${cls}`}
    >
      <span className="text-[10px] text-faint">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
      {shortcut && (
        <span className="text-[8px] font-mono opacity-40 border border-current/30 rounded px-0.5 leading-tight select-none">
          {shortcut}
        </span>
      )}
    </button>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
  shortcut,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer border ${
        active
          ? "bg-primary/15 text-primary border-primary/30"
          : "border-border text-muted bg-elevated hover:text-fg"
      }`}
    >
      {label}
      {shortcut && (
        <span className="text-[8px] font-mono opacity-40 border border-current/30 rounded px-0.5 leading-tight select-none">
          {shortcut}
        </span>
      )}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border border-border/60 rounded px-1 py-0.5 font-mono bg-elevated/60 text-[9px] text-faint">
      {children}
    </kbd>
  );
}
