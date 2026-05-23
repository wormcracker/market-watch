"use client";

import { Suspense } from "react";
import { useState } from "react";
import WatchersTab from "./WatchersTab";
import AlertsTab from "./AlertsTab";
import WatchFormDrawer from "./WatchFormDrawer";
import { Bell, Radio, Plus } from "lucide-react";
import { useQueryTab } from "@/hooks/useQueryTab";

type Tab = "watches" | "alerts";

// Suspense wrapper needed because useSearchParams() requires it in Next.js 15
export default function WatchersPage() {
  return (
    <Suspense>
      <WatchersPageInner />
    </Suspense>
  );
}

function WatchersPageInner() {
  const [tab, setTab] = useQueryTab<Tab>(["watches", "alerts"], "watches");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 pb-10 max-w-screen-2xl mx-auto w-full page-enter">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-2xl p-1">
          <TabBtn
            active={tab === "watches"}
            onClick={() => setTab("watches")}
            icon={<Radio size={13} />}
            label="Watches"
          />
          <TabBtn
            active={tab === "alerts"}
            onClick={() => setTab("alerts")}
            icon={<Bell size={13} />}
            label="Alerts"
          />
        </div>

        {tab === "watches" && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-bg rounded-xl text-xs font-semibold hover:bg-primary-strong transition cursor-pointer"
          >
            <Plus size={13} /> New Watch
          </button>
        )}
      </div>

      <div className="tab-panel">
        {tab === "watches" && (
          <WatchersTab onNewWatch={() => setDrawerOpen(true)} />
        )}
        {tab === "alerts" && <AlertsTab />}
      </div>

      <WatchFormDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
        active
          ? "bg-primary text-bg shadow-sm"
          : "text-muted hover:text-fg hover:bg-elevated"
      }`}
    >
      {icon} {label}
    </button>
  );
}
