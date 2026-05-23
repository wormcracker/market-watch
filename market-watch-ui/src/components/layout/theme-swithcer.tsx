"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const THEMES = [
  { id: "dark",      label: "Dark",      swatch: "#8ab4f8" },
  { id: "light",     label: "Light",     swatch: "#1a73e8" },
  { id: "ocean",     label: "Ocean",     swatch: "#38bdf8" },
  { id: "forest",    label: "Forest",    swatch: "#4ade80" },
  { id: "sunset",    label: "Sunset",    swatch: "#fb7185" },
  { id: "lavender",  label: "Lavender",  swatch: "#c084fc" },
  { id: "rosegold",  label: "Rose Gold", swatch: "#fda4af" },
  { id: "cyberpunk", label: "Cyberpunk", swatch: "#00e5ff" },
  { id: "midnight",  label: "Midnight",  swatch: "#60a5fa" },
  { id: "paper",     label: "Paper",     swatch: "#2563eb" },
  { id: "coffee",    label: "Coffee",    swatch: "#c08457" },
  { id: "arctic",    label: "Arctic",    swatch: "#0284c7" },
];

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState("dark");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? "dark";
    setCurrent(saved);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function apply(id: string) {
    setCurrent(id);
    localStorage.setItem("theme", id);
    document.documentElement.setAttribute("data-theme", id);
    setOpen(false);
  }

  const active = THEMES.find((t) => t.id === current) ?? THEMES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-elevated hover:bg-surface2 py-1.5 px-3 rounded-full text-xs text-muted hover:text-fg transition cursor-pointer"
      >
        <span
          className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/10"
          style={{ background: active.swatch }}
        />
        <span className="hidden sm:inline">{active.label}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-surface border border-border rounded-2xl shadow-2xl z-50 py-1.5 overflow-hidden">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => apply(t.id)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs transition cursor-pointer ${
                current === t.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-elevated hover:text-fg"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/10"
                style={{ background: t.swatch }}
              />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
