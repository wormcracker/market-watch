"use client";

import { useParams } from "next/navigation";
import { StockPageContent } from "@/components/stocks/StockPageContent";

// Route entry point: /stocks/[symbol]
// Thin shell — just resolves the param and delegates to the shared component.
// The modal in WatchlistPage renders StockPageContent directly with a prop.
export default function StockPage() {
  const { symbol } = useParams<{ symbol: string }>();
  return <StockPageContent symbol={symbol} />;
}
