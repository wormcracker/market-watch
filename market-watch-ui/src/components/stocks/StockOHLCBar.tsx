"use client";

import { useAppStore } from "@/store/app";
import type { StockEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type Props = {
  symbol: string;
  fallback?: StockEntry;
};

export function StockOHLCBar({ symbol, fallback }: Props) {
  const stock = useAppStore((s) => s.prices[symbol]) ?? fallback;

  if (!stock) return null;

  const { open, high, low, ltp, percentChange, updatedAt } = stock;

  const isUp = percentChange >= 0;
  const color = isUp ? "var(--color-positive)" : "var(--color-danger)";

  const range = Math.max(high - low, 0.0001);

  const scale = (v: number) => ((high - v) / range) * 100;

  const openY = scale(open);
  const closeY = scale(ltp);
  const highY = scale(high);
  const lowY = scale(low);

  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(Math.abs(closeY - openY), 3);
  const PADDING = 6;

  const clampY = (y: number) => Math.max(PADDING, Math.min(100 - PADDING, y));

  const centerX = 50;

  return (
    <div className="bg-surface rounded-2xl p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted uppercase tracking-wider">OHLC</p>
        <p className="text-[10px] text-faint">{formatDate(updatedAt)}</p>
      </div>

      {/* Values grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Open", value: open, color: "text-fg" },
          { label: "High", value: high, color: "text-positive" },
          { label: "Low", value: low, color: "text-danger" },
          {
            label: "Close",
            value: ltp,
            color: isUp ? "text-positive" : "text-danger",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-0.5 bg-elevated rounded-xl p-2.5"
          >
            <span className="text-[9px] text-faint uppercase">
              {item.label}
            </span>
            <span className={`text-sm font-mono font-semibold ${item.color}`}>
              {item.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-40 w-full bg-elevated rounded-xl flex items-center justify-center">
        <svg width="140" height="140" viewBox="0 0 100 100">
          {/* wick */}
          <line
            x1={centerX}
            x2={centerX}
            y1={highY}
            y2={lowY}
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* body */}
          <rect
            x={centerX - 6}
            y={bodyTop}
            width="12"
            height={bodyHeight}
            rx="2"
            fill={color}
            opacity="0.9"
          />

          {/* ===== O H L C POSITIONS ===== */}
          {(() => {
            const items = [
              { label: "H", y: clampY(highY), value: high },
              { label: "O", y: clampY(openY), value: open },
              { label: "C", y: clampY(closeY), value: ltp },
              { label: "L", y: clampY(lowY), value: low },
            ];

            // sort by Y so we can prevent overlap
            const sorted = [...items].sort((a, b) => a.y - b.y);

            const adjusted: { label: string; y: number; value: number }[] = [];

            const minGap = 6; // minimum pixel spacing in SVG units

            for (const item of sorted) {
              let y = item.y;

              for (const prev of adjusted) {
                if (Math.abs(y - prev.y) < minGap) {
                  y = prev.y + minGap;
                }
              }

              adjusted.push({ ...item, y });
            }

            return adjusted.map((item) => (
              <g key={item.label}>
                {/* small connector line */}
                <line
                  x1={centerX + 10}
                  x2={centerX + 18}
                  y1={item.y}
                  y2={item.y}
                  stroke="currentColor"
                  opacity="0.4"
                />

                {/* label */}
                <text
                  x={centerX + 20}
                  y={item.y + 2}
                  fontSize="6"
                  fill={color}
                  fontWeight="600"
                >
                  {item.label} {item.value.toFixed(2)}
                </text>
              </g>
            ));
          })()}
        </svg>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted">Open: {open.toFixed(2)}</span>

        <span className={isUp ? "text-positive" : "text-danger"}>
          LTP: {ltp.toFixed(2)} ({isUp ? "+" : ""}
          {percentChange.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}
