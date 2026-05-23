"use client";

import { WatchlistEntry } from "@/lib/types";
import { ArrowLeft, ChartLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StockChartPanel } from "./StockChartPanel";

type Props = {
  symbol: string;
  message?: string;
  watchlist?: WatchlistEntry;
};

export function StockHeader({ symbol, watchlist }: Props) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/stocks")}
          className="p-2 rounded-full hover:bg-elevated transition"
        >
          <ArrowLeft size={18} className="text-muted" />
        </button>
        <div>
          <StockChartPanel symbol={symbol.toUpperCase()} />
        </div>

        {watchlist?.unlockIn && (
          <p
            className={`text-sm ${watchlist.isLocked ? "bg-warning/10 text-warning" : "bg-surface"}  px-4 py-1.5 rounded-full max-w-xs text-center`}
          >
            Unlock: [ {watchlist?.unlockIn} ]
            {watchlist?.lockInDate && <span> {watchlist?.lockInDate}</span>}
          </p>
        )}
        {watchlist?.message && (
          <p
            className="text-sm text-warning bg-warning/10
      px-4 py-1.5 rounded-full max-w-xs text-center"
          >
            {watchlist?.message}
          </p>
        )}
      </div>
      <div className="px-4 py-2 bg-surface rounded-2xl flex gap-2">
        <Link
          href={`https://www.nepsealpha.com/trading/chart?symbol=${symbol.toUpperCase()}`}
          target="_blank"
        >
          <ChartLine size={24} />
        </Link>
      </div>
    </div>
  );
}
