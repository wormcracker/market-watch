"use client";
import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { BottomNav } from "./bottom-nav";

function DataHydrator() {
  const refreshAll = useAppStore(s => s.refreshAll);
  useEffect(() => { refreshAll(); }, [refreshAll]);
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bg">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-3 md:p-4 pb-20 md:pb-4">
          {children}
        </main>
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DataHydrator />
      <Shell>{children}</Shell>
    </>
  );
}
