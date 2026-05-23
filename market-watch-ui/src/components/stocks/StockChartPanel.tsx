"use client";

import { useEffect, useState } from "react";

export function StockChartPanel({ symbol }: { symbol: string }) {
  const [open, setOpen] = useState(false);

  // ESC to close + lock scroll
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    if (open) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="w-full px-4 py-2 rounded-2xl bg-surface text-primary-foreground text-sm hover:opacity-90 transition"
      >
        {symbol}
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          {/* Container */}
          <div className="w-full h-full max-w-[1600px] max-h-[90vh] bg-surface rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-border bg-card">
              <div className="text-sm font-medium">
                {symbol} · NepseAlpha Chart
              </div>

              <button
                onClick={() => setOpen(false)}
                className="text-sm px-3 py-1 rounded-md bg-muted hover:bg-muted/80 transition"
              >
                Close
              </button>
            </div>

            {/* Chart area */}
            <div className="flex-1 p-4 bg-background">
              <div className="w-full h-full rounded-xl overflow-hidden border border-border">
                <iframe
                  src={`https://www.nepsealpha.com/trading/chart?symbol=${symbol}`}
                  className="w-full h-full"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
