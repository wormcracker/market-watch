"use client";
import { LockedBanner } from "@/components/layout/demo-banner";
import {
  Lock,
  Database,
  Radio,
  BarChart3,
  Trash2,
  Github,
  RefreshCw,
} from "lucide-react";
import { db } from "@/lib/demo-store";
import { useAppStore } from "@/store/app";
import { useState } from "react";

export default function SettingsPage() {
  const refreshAll = useAppStore((s) => s.refreshAll);
  const [resetDone, setResetDone] = useState(false);

  function handleReset() {
    if (!confirm("Reset all demo data back to defaults?")) return;
    db.reset();
    refreshAll();
    setResetDone(true);
    setTimeout(() => setResetDone(false), 3000);
  }

  return (
    <div className="flex flex-col gap-4 pb-10 max-w-screen-lg mx-auto w-full">
      {/* Demo data controls — these DO work */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-fg mb-1 flex items-center gap-2">
          <Database size={15} className="text-primary" /> Demo Data Controls
        </p>
        <p className="text-xs text-muted mb-4">
          These controls affect your browser's localStorage demo data.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 bg-danger/10 border border-danger/20 text-danger rounded-xl text-xs font-medium hover:bg-danger/15 transition cursor-pointer"
          >
            <Trash2 size={13} /> Reset to Seed Data
          </button>
          <button
            onClick={() => {
              refreshAll();
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-elevated border border-border text-muted rounded-xl text-xs font-medium hover:text-fg hover:bg-surface2 transition cursor-pointer"
          >
            <RefreshCw size={13} /> Reload from Storage
          </button>
        </div>

        {resetDone && (
          <p className="text-xs text-positive mt-3">✓ Data reset to defaults</p>
        )}
      </div>

      {/* Locked sections — previews only */}
      <LockedSection
        icon={<BarChart3 size={15} className="text-primary" />}
        title="Stock Management Settings"
        description="Configure Google Sheets integration, commission tiers, capital limits, and per-stock target allocations."
        items={[
          "Google Spreadsheet ID",
          "NEPSE security → symbol map",
          "Margin stock highlighting",
          "Per-stock max capital (maxPerStock)",
          "Portfolio data sync controls",
        ]}
      />

      <LockedSection
        icon={<Radio size={15} className="text-primary" />}
        title="Watcher Settings"
        description="Configure notification channels, scheduler behaviour, and alert templates."
        items={[
          "Discord / Slack / ntfy / Telegram webhooks",
          "Default interval and jitter",
          "Max concurrent watchers (Semaphore)",
          "Alert cooldown and history limits",
          "OS notification sound & template",
        ]}
      />

      <LockedSection
        icon={<Database size={15} className="text-primary" />}
        title="NEPSE Data Settings"
        description="Configure the market data scheduler, fallback order, and cache TTL."
        items={[
          "Fallback order (source-a → cache)",
          "Scheduler market windows",
          "Sub-slot interval overrides",
          "Cache TTL and disk path",
          "Market status check toggle",
        ]}
      />

      {/* GitHub CTA */}
      <div className="bg-elevated border border-border rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-fg">
            Run the full version locally
          </p>
          <p className="text-xs text-muted mt-1">
            Clone the repo, add your .env, and get live NEPSE data + full
            settings.
          </p>
        </div>
        <a
          href="https://github.com/wormcracker/market-watch"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-bg rounded-xl text-xs font-semibold hover:bg-primary-strong transition shrink-0"
        >
          <Github size={14} /> View on GitHub
        </a>
      </div>
    </div>
  );
}

function LockedSection({
  icon,
  title,
  description,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 opacity-70">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-fg flex items-center gap-2">
          {icon}
          {title}
        </p>
        <span className="flex items-center gap-1 text-[10px] text-faint px-2 py-1 bg-elevated rounded-full">
          <Lock size={9} /> Local build only
        </span>
      </div>
      <p className="text-xs text-muted mb-3">{description}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center gap-2 text-xs text-faint"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
