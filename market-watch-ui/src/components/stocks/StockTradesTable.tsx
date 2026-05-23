import { useState } from "react";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";
import type { Trade } from "@/lib/types";

type Props = { trades: Trade[] };

const PREVIEW_COUNT = 5;

export function StockTradesTable({ trades }: Props) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...trades].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const visible = showAll ? sorted : sorted.slice(0, PREVIEW_COUNT);
  const hasMore = trades.length > PREVIEW_COUNT;

  return (
    <div className="bg-surface rounded-2xl p-5 flex flex-col gap-4 ">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted uppercase tracking-wider">
          Trades
          <span className="ml-2 text-faint">({trades.length})</span>
        </p>
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-primary hover:text-primary-strong transition cursor-pointer"
          >
            {showAll ? "Show Less" : `Show All ${trades.length}`}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-150 w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Date", "Type", "Qty", "Price", "Net P&L", "Days"].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs text-muted pb-2 pr-4 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((trade) => {
              const isSell = trade.type === "sell";
              const price = isSell ? trade.sellPrice : trade.buyWacc;
              return (
                <tr
                  key={trade.tradeId}
                  className="border-b border-border/50 hover:bg-elevated transition"
                >
                  <td className="py-2.5 pr-4 text-muted text-xs">
                    {formatDate(trade.date)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`
                      text-xs font-medium px-2 py-0.5 rounded-full
                      ${
                        isSell
                          ? "bg-danger/10 text-danger"
                          : "bg-positive/10 text-positive"
                      }
                    `}
                    >
                      {trade.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-fg">
                    {trade.qty.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-fg">
                    {formatCurrency(price)}
                  </td>
                  <td
                    className={`py-2.5 pr-4 font-mono text-xs ${
                      !isSell
                        ? "text-faint"
                        : trade.netPl >= 0
                          ? "text-positive"
                          : "text-danger"
                    }`}
                  >
                    {isSell ? formatCurrency(trade.netPl) : "—"}
                  </td>
                  <td
                    className={`py-2.5 pr-4 font-mono text-xs ${
                      !isSell
                        ? "text-faint"
                        : trade.plPct >= 0
                          ? "text-positive"
                          : "text-danger"
                    }`}
                  >
                    {isSell ? formatPercent(trade.plPct) : "—"}
                  </td>
                  <td className="py-2.5 text-muted text-xs font-mono">
                    {isSell ? `${trade.holdingDays}d` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Remarks if any */}
      {trades.some((t) => t.remarks) && (
        <div>
          <p className="text-[10px] text-muted uppercase tracking-wider mb-2">
            Trade Notes
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {trades
              .filter((t) => t.remarks)
              .map((t) => (
                <div
                  key={t.tradeId}
                  className="shrink-0 w-48 bg-elevated rounded-xl p-3 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                ${t.type === "sell" ? "bg-danger/10 text-danger" : "bg-positive/10 text-positive"}`}
                    >
                      {t.type.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-faint">
                      {formatDate(t.date)}
                    </span>
                  </div>
                  <p className="text-xs text-fg leading-relaxed">{t.remarks}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
