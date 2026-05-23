import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import type { SummaryData } from "@/lib/types";

type Props = { summary: SummaryData };

export function StockSummaryPanel({ summary }: Props) {
  const plPositive = summary.profit >= 0;
  const rows = [
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
      sub: null,
    },
    {
      label: "CGT Paid",
      value: formatCurrency(summary.cgtPaid),
      sub: null,
    },
    {
      label: "Realized P&L",
      value: `${formatCurrency(summary.profit)} (${formatPercent(summary.plPct)})`,
      sub: null,
      highlight: plPositive ? "positive" : "danger",
    },
    {
      label: "Avg Hold",
      value: `${summary.avgHoldDays} days`,
      sub: null,
    },
    {
      label: "CAGR",
      value: formatPercent(summary.caagr),
      sub: null,
      highlight: summary.caagr >= 0 ? "positive" : "danger",
    },
    {
      label: "First Trade",
      value: formatDate(summary.firstTradeDate),
      sub: null,
    },
    {
      label: "Last Trade",
      value: formatDate(summary.lastTradeDate),
      sub: null,
    },
  ] as const;

  return (
    <div className="bg-surface rounded-2xl p-5 flex flex-col gap-4">
      <p className="text-xs text-muted uppercase tracking-wider">Summary</p>

      <div
        className="grid gap-x-6 gap-y-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
      >
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-0.5 bg-elevated rounded-xl p-3 "
          >
            <span className="text-xs text-muted">{row.label}</span>
            <span
              className={`
              text-sm font-mono font-medium
              ${
                "highlight" in row && row.highlight === "positive"
                  ? "text-positive"
                  : "highlight" in row && row.highlight === "danger"
                    ? "text-danger"
                    : "text-fg"
              }
            `}
            >
              {row.value}
            </span>
            {row.sub && (
              <span className="text-[10px] text-faint">{row.sub}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
