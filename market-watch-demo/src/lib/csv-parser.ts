import type { LtpEntry } from "./types";

/**
 * Parses the official NEPSE today-price CSV from nepalstock.com/today-price
 *
 * Expected columns (any order, header row required):
 *   Symbol, Close Price, Open Price, High Price, Low Price
 *
 * Also handles a simpler format: symbol,ltp
 */
export function parseNepseCsv(text: string): { rows: LtpEntry[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ["CSV is empty or has no data rows"] };

  const errors: string[] = [];
  const headerRaw = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, " "));

  // Column index finder
  const ci = (names: string[]): number =>
    names.reduce((found, n) => found >= 0 ? found : headerRaw.indexOf(n), -1);

  const iSymbol = ci(["symbol"]);
  const iClose  = ci(["close price", "ltp", "close"]);
  const iOpen   = ci(["open price", "open"]);
  const iHigh   = ci(["high price", "high"]);
  const iLow    = ci(["low price", "low"]);
  const iChg    = ci(["% change", "change %", "chg%", "percent change"]);

  if (iSymbol < 0) return { rows: [], errors: ["Could not find 'Symbol' column"] };
  if (iClose  < 0) return { rows: [], errors: ["Could not find 'Close Price' or 'LTP' column"] };

  const rows: LtpEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
    const symbol = cols[iSymbol]?.toUpperCase();
    const ltp    = parseFloat(cols[iClose]);

    if (!symbol || isNaN(ltp) || ltp <= 0) continue;

    rows.push({
      symbol,
      ltp,
      open:   iOpen >= 0 ? parseFloat(cols[iOpen])  || undefined : undefined,
      high:   iHigh >= 0 ? parseFloat(cols[iHigh])  || undefined : undefined,
      low:    iLow  >= 0 ? parseFloat(cols[iLow])   || undefined : undefined,
      chgPct: iChg  >= 0 ? parseFloat(cols[iChg])   || undefined : undefined,
    });
  }

  if (rows.length === 0) errors.push("No valid rows found");

  return { rows, errors };
}
