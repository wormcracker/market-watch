"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  PieChart,
  Eye,
  MoreHorizontal,
  ArrowLeftRight,
  Radio,
  Settings,
  X,
} from "lucide-react";
import { useAppStore } from "@/store/app";

const PRIMARY_ITEMS = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Portfolio", path: "/portfolio", icon: PieChart },
  { label: "Stocks", path: "/stocks", icon: Eye },
];

const MORE_ITEMS = [
  { label: "Trades", path: "/trades", icon: ArrowLeftRight },
  { label: "Watchers", path: "/watchers", icon: Radio }, // ← renamed
  { label: "Settings", path: "/settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const liveUnreadCount = useAppStore((s) => s.liveUnreadCount);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  return (
    <div ref={ref} className="relative">
      {moreOpen && (
        <div className="absolute bottom-full left-0 right-0 mx-2 mb-2 bg-surface border border-border rounded-2xl p-2 shadow-2xl z-50">
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-[10px] text-faint uppercase tracking-widest">
              More
            </span>
            <button
              onClick={() => setMoreOpen(false)}
              className="text-faint hover:text-fg cursor-pointer p-1"
            >
              <X size={14} />
            </button>
          </div>
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-elevated hover:text-fg"
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
                {item.label === "Watchers" && liveUnreadCount > 0 && (
                  <span className="ml-auto text-[10px] bg-danger text-bg rounded-full px-1.5 py-0.5 font-bold">
                    {liveUnreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <nav className="flex items-center bg-surface/90 backdrop-blur-xl border-t border-border px-2 pb-safe">
        {PRIMARY_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? pathname === "/"
              : pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-1 flex-col items-center gap-1 py-3 transition ${
                isActive ? "text-primary" : "text-faint"
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={`flex flex-1 flex-col items-center gap-1 py-3 transition relative ${
            MORE_ITEMS.some((i) => pathname.startsWith(i.path))
              ? "text-primary"
              : "text-faint"
          }`}
        >
          <div className="relative">
            <MoreHorizontal size={20} />
            {liveUnreadCount > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[9px] bg-danger text-bg rounded-full px-1 font-bold leading-none py-0.5">
                {liveUnreadCount > 9 ? "9+" : liveUnreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </div>
  );
}
