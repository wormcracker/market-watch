"use client";
import { useRef, useState } from "react";
import { Upload, X, CheckCircle2, AlertCircle, ExternalLink, FileText } from "lucide-react";
import { parseNepseCsv } from "@/lib/csv-parser";
import { db } from "@/lib/demo-store";
import { useAppStore } from "@/store/app";

interface Props { open: boolean; onClose: () => void; }

export default function CsvUploadModal({ open, onClose }: Props) {
  const refreshAll = useAppStore(s => s.refreshAll);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string; count?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function processFile(file: File) {
    setLoading(true);
    setStatus(null);
    try {
      const text = await file.text();
      const { rows, errors } = parseNepseCsv(text);
      if (errors.length && !rows.length) {
        setStatus({ ok: false, msg: errors[0] });
      } else {
        db.ingestCsv(rows);
        refreshAll();
        setStatus({ ok: true, msg: `Prices updated from CSV`, count: rows.length });
      }
    } catch {
      setStatus({ ok: false, msg: "Failed to parse file" });
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-fg">Upload Market Data</p>
            <p className="text-[11px] text-muted mt-0.5">NEPSE today-price CSV</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-elevated transition cursor-pointer">
            <X size={15} className="text-muted" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Official source link */}
          <a
            href="https://www.nepalstock.com/today-price"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary hover:bg-primary/15 transition"
          >
            <ExternalLink size={13} />
            <div className="flex-1">
              <p className="font-semibold">Download from nepalstock.com/today-price</p>
              <p className="text-primary/70 mt-0.5">Official NEPSE source — download CSV then upload here</p>
            </div>
          </a>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl py-10 flex flex-col items-center gap-3 cursor-pointer transition ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-elevated/30"
            }`}
          >
            <FileText size={28} className="text-faint" />
            <div className="text-center">
              <p className="text-sm text-fg font-medium">
                {loading ? "Processing…" : "Drop CSV here or click to browse"}
              </p>
              <p className="text-[11px] text-faint mt-1">Supports NEPSE today-price format</p>
            </div>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
          </div>

          {/* Status */}
          {status && (
            <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs ${
              status.ok
                ? "bg-positive/10 border border-positive/20 text-positive"
                : "bg-danger/10 border border-danger/20 text-danger"
            }`}>
              {status.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
              <div>
                <p className="font-semibold">{status.msg}</p>
                {status.count !== undefined && (
                  <p className="opacity-80 mt-0.5">{status.count} symbols updated — portfolio LTPs refreshed</p>
                )}
              </div>
            </div>
          )}

          {/* Column guide */}
          <div className="bg-elevated rounded-xl px-4 py-3">
            <p className="text-[10px] text-faint uppercase tracking-wider mb-2">Expected columns</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              {["Symbol", "Close Price", "Open Price", "High Price", "Low Price"].map(c => (
                <span key={c} className="text-muted font-mono">• {c}</span>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted hover:text-fg hover:bg-elevated transition cursor-pointer">
              {status?.ok ? "Close" : "Cancel"}
            </button>
            {status?.ok && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm bg-primary text-bg font-medium hover:bg-primary-strong transition cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
