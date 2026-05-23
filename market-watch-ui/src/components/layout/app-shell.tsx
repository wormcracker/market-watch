"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app";
import { useWebSocket } from "@/hooks/useWebsocket";
import { apiFetch } from "@/lib/api";
import type {
  Position,
  CapitalSummary,
  WatchlistEntry,
  TradesResponse,
  SummaryData,
} from "@/lib/types";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { BottomNav } from "./bottom-nav";
import { useEffect, useRef } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// ── Central data prefetcher ──────────────────────────────────
function DataPrefetcher() {
  const setPositions = useAppStore((s) => s.setPositions);
  const setCapital = useAppStore((s) => s.setCapital);
  const setWatchlist = useAppStore((s) => s.setWatchlist);
  const setTrades = useAppStore((s) => s.setTrades);
  const setSummaryAll = useAppStore((s) => s.setSummaryAll);

  useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const raw = await apiFetch<unknown>("stocks/positions");
      let positions: Position[] = [];
      if (Array.isArray(raw)) positions = raw as Position[];
      else if (raw && typeof raw === "object") {
        const o = raw as Record<string, unknown>;
        if (Array.isArray(o.positions)) positions = o.positions as Position[];
        else positions = Object.values(o) as Position[];
      }
      setPositions(positions);
      return positions;
    },
    refetchInterval: 30_000,
  });

  useQuery({
    queryKey: ["capital"],
    queryFn: async () => {
      const d = await apiFetch<CapitalSummary>("stocks/capital");
      if (d) setCapital(d);
      return d;
    },
    refetchInterval: 60_000,
  });

  useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const d = await apiFetch<WatchlistEntry[]>("stocks/watchlist");
      if (d) setWatchlist(d);
      return d;
    },
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  useQuery({
    queryKey: ["trades-all"],
    queryFn: async () => {
      const d = await apiFetch<TradesResponse>("stocks/trades?limit=2000");
      if (d?.trades) setTrades(d.trades);
      return d;
    },
    refetchInterval: 30_000,
  });

  useQuery({
    queryKey: ["summary-all"],
    queryFn: async () => {
      const d = await apiFetch<SummaryData>("stocks/summary?filter=all");
      if (d) setSummaryAll(d);
      return d;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  return null;
}

// ── Shell ────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  const setWsStatus = useAppStore((s) => s.setWsStatus);
  const setPrices = useAppStore((s) => s.setPrices);
  const addLiveAlert = useAppStore((s) => s.addLiveAlert);

  useWebSocket({
    onConnected: () => setWsStatus("connected"),
    onMarketUpdate: (payload) => setPrices(payload.data, payload.source),
    onAlertFired: (payload) => {
      addLiveAlert(payload);
    },
    onDisconnected: () => setWsStatus("disconnected"),
  });

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bg">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-3 md:p-4 pb-20 md:pb-4">
          <PageTransition>{children}</PageTransition>
        </main>
        {/* Bottom nav — mobile only */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DataPrefetcher />
      <Shell>{children}</Shell>
    </QueryClientProvider>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.animation = "none";
      void ref.current.offsetHeight; // reflow
      ref.current.style.animation = "";
    }
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter min-h-full">
      {children}
    </div>
  );
}
