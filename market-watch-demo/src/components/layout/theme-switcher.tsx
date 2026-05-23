"use client";
import { useState, useEffect, useRef } from "react";
import { Palette, Check } from "lucide-react";

const THEMES = [
  { id: "dark",     label: "Dark",      dot: "#8ab4f8" },
  { id: "light",    label: "Light",     dot: "#1a73e8" },
  { id: "ocean",    label: "Ocean",     dot: "#38bdf8" },
  { id: "forest",   label: "Forest",    dot: "#4ade80" },
  { id: "sunset",   label: "Sunset",    dot: "#fb7185" },
  { id: "lavender", label: "Lavender",  dot: "#c084fc" },
  { id: "rosegold", label: "Rose Gold", dot: "#fda4af" },
  { id: "midnight", label: "Midnight",  dot: "#60a5fa" },
  { id: "paper",    label: "Paper",     dot: "#2563eb" },
  { id: "coffee",   label: "Coffee",    dot: "#c08457" },
  { id: "arctic",   label: "Arctic",    dot: "#0284c7" },
];

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("dark");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function apply(id: string) {
    setTheme(id);
    localStorage.setItem("theme", id);
    document.documentElement.setAttribute("data-theme", id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-full bg-elevated hover:bg-surface2 transition cursor-pointer"
        title="Change theme"
      >
        <Palette size={14} className="text-fg" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-surface border border-border rounded-2xl shadow-2xl z-50 p-2 overflow-hidden">
          <p className="text-[10px] text-faint uppercase tracking-widest px-2 pb-1.5">Theme</p>
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => apply(t.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-elevated transition text-left cursor-pointer"
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.dot }} />
              <span className="text-xs text-fg flex-1">{t.label}</span>
              {theme === t.id && <Check size={11} className="text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
