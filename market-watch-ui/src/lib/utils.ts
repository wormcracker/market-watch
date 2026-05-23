import { ParsedRemark, ParsedSlTp } from "./types";

export function formatCurrency(value: number): string {
  return `Rs. ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

export function formatDate(value: string | number) {
  const date =
    typeof value === "number"
      ? new Date(value < 1e12 ? value * 1000 : value)
      : new Date(value);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function parseRemark(raw: string): ParsedRemark | null {
  const cleaned = raw.trim().replace(/\s+/g, " ");

  const match = cleaned.match(
    /^([\d.,/\s|]+)\(\s*([1-3])\s*,\s*([1-6])\s*,\s*([1-3])\s*,\s*([1-3])\s*\)$/,
  );

  if (!match) return null;

  const entryPrices = match[1]
    .split(/[,/|]+/)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);

  if (entryPrices.length === 0 || entryPrices.length > 4) return null;

  const ratings: [number, number, number, number] = [
    parseInt(match[2], 10),
    parseInt(match[3], 10),
    parseInt(match[4], 10),
    parseInt(match[5], 10),
  ];

  const WEIGHTS = [100, 80, 70, 50];
  const maxScore = WEIGHTS.reduce((sum, w) => sum + w * 3, 0);

  const actual = ratings.reduce((sum, r, i) => sum + r * WEIGHTS[i], 0);
  const score = Math.round((actual / maxScore) * 100);

  return {
    entryPrices,
    alertPrice: Math.round(entryPrices[0] * 1.02),
    ratings,
    score,
    scoreLabel: score <= 33 ? "Low" : score <= 66 ? "Medium" : "Strong",
  };
}

export function parseSlTp(raw: string): ParsedSlTp | null {
  const parts = raw.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length !== 2) return null;
  if (parts.some(isNaN) || parts.some((n) => n <= 0)) return null;
  if (parts[0] >= parts[1]) return null; // sl must be < tp
  return { sl: parts[0], tp: parts[1] };
}
