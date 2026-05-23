"use client";
import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app";
import { formatPercent } from "@/lib/utils";
import type { WatchlistEntry } from "@/lib/types";
import { Search, Star, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp } from "lucide-react";

const CAP_LABEL: Record<string, string> = { h: "Large", m: "Mid", s: "Small" };
const CAP_ORDER: Record<string, number> = { h: 0, m: 1, s: 2 };

export default function StocksPage() {
  const watchlist = useAppStore(s => s.watchlist);
  const prices    = useAppStore(s => s.prices);
  const [search, setSearch]     = useState("");
  const [capFilter, setCapFilter] = useState<string>("all");
  const [watchOnly, setWatchOnly] = useState(false);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const enriched = useMemo(() =>
    watchlist.map(w => {
      const live = prices[w.symbol];
      return {
        ...w,
        ltp:    live?.ltp    ?? w.ltp,
        chgPct: live?.percentChange ?? w.chgPct,
        high:   live?.high   ?? w.high,
        low:    live?.low    ?? w.low,
      };
    }),
    [watchlist, prices]
  );

  const caps = [...new Set(enriched.map(w => w.cap).filter(c => c !== "Main" && c !== "-"))];

  const filtered = useMemo(() =>
    enriched
      .filter(w => w.cap !== "Main" && w.cap !== "-")
      .filter(w => !search || w.symbol.toLowerCase().includes(search.toLowerCase()))
      .filter(w => capFilter === "all" || w.cap === capFilter)
      .filter(w => !watchOnly || w.watch)
      .sort((a, b) => (CAP_ORDER[a.cap] ?? 9) - (CAP_ORDER[b.cap] ?? 9) || a.symbol.localeCompare(b.symbol)),
    [enriched, search, capFilter, watchOnly]
  );

  // group by cap
  const grouped = useMemo(() => {
    const map: Record<string, WatchlistEntry[]> = {};
    filtered.forEach(w => {
      if (!map[w.cap]) map[w.cap] = [];
      map[w.cap].push(w);
    });
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4 pb-10 max-w-screen-2xl mx-auto w-full">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 flex-1 min-w-40">
          <Search size={13} className="text-faint shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search symbol…"
            className="bg-transparent text-xs text-fg placeholder:text-faint outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
          {["all", ...caps].map(cap => (
            <button key={cap} onClick={() => setCapFilter(cap)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer capitalize ${
                capFilter === cap ? "bg-primary text-bg" : "text-muted hover:text-fg hover:bg-elevated"
              }`}
            >
              {cap === "all" ? "All" : (CAP_LABEL[cap] ?? cap)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setWatchOnly(!watchOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer border ${
            watchOnly ? "bg-warning/10 border-warning/30 text-warning" : "bg-surface border-border text-muted hover:text-fg"
          }`}
        >
          <Star size={12} className={watchOnly ? "fill-warning text-warning" : ""} />
          Watchlist
        </button>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-surface border border-border rounded-xl text-xs text-muted">
        <span>{filtered.length} symbols</span>
        <span>·</span>
        <span className="text-positive">{filtered.filter(w => w.chgPct > 0).length} up</span>
        <span>·</span>
        <span className="text-danger">{filtered.filter(w => w.chgPct < 0).length} down</span>
        <span>·</span>
        <span className="text-warning">{filtered.filter(w => w.inPortfolio).length} in portfolio</span>
      </div>

      {/* Groups */}
      {Object.entries(grouped).map(([cap, stocks]) => (
        <div key={cap} className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-elevated/30 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">{CAP_LABEL[cap] ?? cap} Cap</span>
            <span className="text-[10px] text-faint">({stocks.length})</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-4 py-2 text-left text-faint font-medium">Symbol</th>
                  <th className="px-4 py-2 text-right text-faint font-medium">LTP</th>
                  <th className="px-4 py-2 text-right text-faint font-medium">Chg%</th>
                  <th className="px-4 py-2 text-right text-faint font-medium">High</th>
                  <th className="px-4 py-2 text-right text-faint font-medium">Low</th>
                  <th className="px-4 py-2 text-right text-faint font-medium">Target</th>
                  <th className="px-4 py-2 text-center text-faint font-medium">Watch</th>
                  <th className="px-4 py-2 text-center text-faint font-medium">Portfolio</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {stocks.map(w => (
                  <>
                    <tr
                      key={w.symbol}
                      className="border-b border-border/30 hover:bg-elevated/30 transition cursor-pointer"
                      onClick={() => setExpandedSymbol(expandedSymbol === w.symbol ? null : w.symbol)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-fg">{w.symbol}</span>
                          {w.inPortfolio && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-mono">
                              {w.heldQty} held
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-fg">{w.ltp.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`flex items-center justify-end gap-0.5 font-mono ${w.chgPct >= 0 ? "text-positive" : "text-danger"}`}>
                          {w.chgPct >= 0 ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
                          {formatPercent(w.chgPct)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted">{w.high.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted">{w.low.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-mono text-faint">
                        {w.targetCap > 0 ? `Rs. ${(w.targetCap/1000).toFixed(0)}K` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Star size={13} className={w.watch ? "fill-warning text-warning" : "text-faint"} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`w-2 h-2 rounded-full inline-block ${w.inPortfolio ? "bg-positive" : "bg-border"}`} />
                      </td>
                      <td className="px-4 py-3">
                        {expandedSymbol === w.symbol ? <ChevronUp size={13} className="text-faint" /> : <ChevronDown size={13} className="text-faint" />}
                      </td>
                    </tr>

                    {expandedSymbol === w.symbol && (
                      <tr key={`${w.symbol}-detail`} className="bg-elevated/20">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                              <p className="text-faint mb-0.5">Day Range</p>
                              <p className="text-fg font-mono">{w.low.toFixed(1)} – {w.high.toFixed(1)}</p>
                            </div>
                            <div>
                              <p className="text-faint mb-0.5">Cap Size</p>
                              <p className="text-fg">{CAP_LABEL[w.cap] ?? w.cap} Cap</p>
                            </div>
                            {w.inPortfolio && (
                              <>
                                <div>
                                  <p className="text-faint mb-0.5">Held Qty</p>
                                  <p className="text-fg font-mono">{w.heldQty}</p>
                                </div>
                                <div>
                                  <p className="text-faint mb-0.5">Held Value</p>
                                  <p className="text-fg font-mono">Rs. {(w.heldQty * w.ltp).toLocaleString()}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
