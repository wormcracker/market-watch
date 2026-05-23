import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Position } from "@/lib/types";

type Props = {
  position: Position;
};

type Row = {
  label: string;
  value: string;
  highlight?: "positive" | "danger" | null;
};

export function StockLiveSnapshot({ position }: Props) {
  const { qty, avgBuy, invested, chgPct, currentVal, netPL, plPct, ltp } =
    position;

  // Fix rows:
  const rows: Row[] = [
    { label: "Held Qty", value: `${qty} units`, highlight: null },
    { label: "Avg Buy", value: formatCurrency(avgBuy), highlight: null },
    { label: "Invested", value: formatCurrency(invested), highlight: null },
    {
      label: "Current Val",
      value: formatCurrency(currentVal),
      highlight: null,
    },

    {
      label: "Day Change",
      value: formatPercent(chgPct),
      highlight: chgPct >= 0 ? "positive" : "danger",
    },
    {
      label: "Ltp",
      value: String(ltp),
      highlight: null,
    },
    {
      label: "Net P&L",
      value: `${formatCurrency(netPL)}`,
      highlight: netPL >= 0 ? "positive" : "danger",
    },
    {
      label: "P&L %",
      value: `${formatPercent(plPct)})`,
      highlight: plPct >= 0 ? "positive" : "danger",
    },
  ];
  return (
    <div className="bg-surface rounded-2xl p-5 flex flex-col gap-3">
      <p className="text-xs text-muted uppercase tracking-wider">Position</p>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center">
            <span className="text-xs text-muted">{row.label}</span>
            <span
              className={`
              text-sm font-mono font-medium
              ${
                row.highlight === "positive"
                  ? "text-positive"
                  : row.highlight === "danger"
                    ? "text-danger"
                    : "text-fg"
              }
            `}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
