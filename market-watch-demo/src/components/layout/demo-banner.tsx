"use client";
import { Lock, Github, ExternalLink } from "lucide-react";

interface Props {
  feature: string;
  description?: string;
}

export function LockedBanner({ feature, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center">
        <Lock size={28} className="text-faint" />
      </div>

      <div className="max-w-sm">
        <h2 className="text-lg font-semibold text-fg mb-2">{feature}</h2>
        <p className="text-sm text-muted leading-relaxed">
          {description ??
            "This feature requires a running backend and is available in the full local build."}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href="https://github.com/wormcracker/market-watch"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-bg rounded-xl text-sm font-medium hover:bg-primary-strong transition"
        >
          <Github size={15} /> Clone & Run Locally
        </a>
        <a
          href="https://github.com/wormcracker/market-watch#installation"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 bg-elevated text-fg rounded-xl text-sm font-medium hover:bg-surface2 transition"
        >
          <ExternalLink size={13} /> Setup Guide
        </a>
      </div>

      <div className="max-w-sm bg-surface border border-border rounded-xl px-4 py-3 text-left">
        <p className="text-[11px] text-faint uppercase tracking-wider mb-2 font-mono">
          Full build includes
        </p>
        {[
          "Live market data via WebSocket",
          "Google Sheets portfolio sync",
          "Condition-based price alerts",
          "Watcher engine (17 conditions)",
          "Notification channels (Discord, Slack, ntfy…)",
          "Scheduler with market-window awareness",
        ].map((f) => (
          <div key={f} className="flex items-center gap-2 py-1">
            <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
            <span className="text-xs text-muted">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 mb-4 bg-warning/8 border border-warning/20 rounded-xl text-xs text-warning">
      <span className="font-mono font-bold shrink-0 mt-0.5">DEMO</span>
      <p className="text-warning/80 leading-relaxed">
        This is a read-only demo with placeholder data stored in your browser.{" "}
        <strong className="text-warning">
          Trade forms and watcher creation are disabled.
        </strong>{" "}
        Upload a real CSV from{" "}
        <a
          href="https://www.nepalstock.com/today-price"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          nepalstock.com
        </a>{" "}
        to update prices live.
      </p>
    </div>
  );
}
