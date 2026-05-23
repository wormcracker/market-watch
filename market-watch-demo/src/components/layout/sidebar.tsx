"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PieChart, ArrowLeftRight, Eye, Radio, Settings, Menu, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "@/store/app";

type NavItem = { label: string; path: string; shortcut: string; icon: React.ReactNode; locked?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/",          shortcut: "1", icon: <LayoutDashboard size={16} /> },
  { label: "Portfolio",  path: "/portfolio", shortcut: "2", icon: <PieChart size={16} /> },
  { label: "Trades",     path: "/trades",    shortcut: "3", icon: <ArrowLeftRight size={16} /> },
  { label: "Stocks",     path: "/stocks",    shortcut: "4", icon: <Eye size={16} /> },
  { label: "Watchers",   path: "/watchers",  shortcut: "5", icon: <Radio size={16} />, locked: true },
  { label: "Settings",   path: "/settings",  shortcut: "6", icon: <Settings size={16} />, locked: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const unreadAlerts = useAppStore(s => s.unreadAlerts);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={`flex flex-col sticky top-0 m-2 rounded-2xl bg-surface overflow-hidden py-5 gap-1 transition-all duration-300 shrink-0 ${
        collapsed ? "w-20 px-2" : "w-60 px-3"
      }`}
    >
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} mb-4 px-2`}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <LogoIcon />
            <div>
              <span className="text-sm font-semibold text-fg">Market Watch</span>
              <span className="block text-[9px] text-primary font-mono">DEMO</span>
            </div>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-2 rounded-full hover:bg-elevated transition cursor-pointer">
          <Menu size={18} className="text-fg" />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(item => {
          const isActive = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
          const showBadge = item.label === "Watchers" && unreadAlerts > 0;

          return (
            <Link
              key={item.path}
              href={item.path}
              title={collapsed ? item.label : ""}
              className={`flex items-center ${
                collapsed ? "justify-center rounded-2xl" : "justify-between rounded-full"
              } px-4 py-3 tracking-wider transition-all duration-200 group ${
                isActive ? "bg-primary text-bg" : "text-muted hover:bg-elevated hover:text-fg"
              }`}
            >
              <div className={`flex items-center gap-3 ${!collapsed ? "flex-row" : "flex-col"} relative`}>
                <span className="relative">
                  <span className={`transition-colors ${isActive ? "text-bg" : "text-muted group-hover:text-fg"}`}>
                    {item.icon}
                  </span>
                  {showBadge && collapsed && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-danger rounded-full text-[8px] text-bg flex items-center justify-center font-bold">
                      {unreadAlerts > 9 ? "9+" : unreadAlerts}
                    </span>
                  )}
                </span>
                <span className={`font-medium ${collapsed ? "text-[9px]" : "text-sm"}`}>
                  {item.label}
                </span>
              </div>

              {!collapsed && (
                <div className="flex items-center gap-2">
                  {item.locked && (
                    <Lock size={10} className={isActive ? "text-bg/60" : "text-faint"} />
                  )}
                  {showBadge && (
                    <span className="text-[9px] bg-danger text-bg rounded-full px-1.5 py-0.5 font-bold">{unreadAlerts}</span>
                  )}
                  <span className={`text-xs font-mono ${isActive ? "text-bg/70" : "text-faint group-hover:text-muted"}`}>
                    {item.shortcut}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2">
        <div className={`rounded-xl bg-surface border border-border py-2 ${collapsed ? "text-center px-2" : "px-3"}`}>
          {!collapsed ? (
            <>
              <p className="text-xs text-muted">Market Status</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                <p className="text-sm text-fg font-medium">Demo Mode</p>
              </div>
            </>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-warning animate-pulse" />
          )}
        </div>
      </div>
    </aside>
  );
}

function LogoIcon() {
  return (
    <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
      <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
        <polyline points="4,20 9,13 14,16 19,8 24,11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}
