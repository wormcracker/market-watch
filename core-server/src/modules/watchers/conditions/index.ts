import type { Condition, ConditionResult } from "../types";

// ── Shared numeric parser ─────────────────────────────────────────────────────
const n = (v: string): number =>
  parseFloat(v.replace(/,/g, "").replace(/[^\d.\-]/g, ""));

const f = (v: string | number | null): string | number | null =>
  typeof v === "number" ? v.toLocaleString() : v;

// ── Main entry ────────────────────────────────────────────────────────────────
export function evaluate(
  conditions: Condition[],
  currentValue: string,
  prevValue: string | null,
): ConditionResult[] {
  return (conditions || []).map((condition): ConditionResult => {
    try {
      const fired = check(condition, currentValue, prevValue);
      return {
        fired,
        condition,
        currentValue,
        prevValue,
        message: fired
          ? buildMessage(condition, currentValue, prevValue)
          : null,
      };
    } catch (e: any) {
      return {
        condition,
        fired: false,
        currentValue,
        prevValue,
        message: e.message,
      };
    }
  });
}

// ── Single condition check ────────────────────────────────────────────────────
function check(cond: Condition, cur: string, prev: string | null): boolean {
  switch (cond.type) {
    case "any_change":
      return (
        prev !== null && prev !== undefined && String(cur) !== String(prev)
      );
    case "above":
      return n(cur) > cond.threshold;
    case "above_equal":
      return n(cur) >= cond.threshold;
    case "below":
      return n(cur) < cond.threshold;
    case "below_equal":
      return n(cur) <= cond.threshold;
    case "between":
      return n(cur) >= cond.lo && n(cur) <= cond.hi;
    case "outside":
      return n(cur) < cond.lo || n(cur) > cond.hi;
    case "equals":
      return String(cur).trim() === String(cond.threshold).trim();
    case "not_equals":
      return String(cur).trim() !== String(cond.threshold).trim();
    case "contains":
      return String(cur)
        .toLowerCase()
        .includes(String(cond.threshold).toLowerCase());
    case "not_contains":
      return !String(cur)
        .toLowerCase()
        .includes(String(cond.threshold).toLowerCase());
    case "increases":
      return prev != null && n(cur) > n(prev);
    case "decreases":
      return prev != null && n(cur) < n(prev);
    case "count_above":
      return n(cur) > cond.threshold;
    case "count_below":
      return n(cur) < cond.threshold;
    case "change_pct": {
      if (prev == null) return false;
      const pn = n(prev);
      if (pn === 0) return false;
      const pct = Math.abs((n(cur) - pn) / Math.abs(pn)) * 100;
      return dirCheck(pct, cond.threshold, n(cur) - pn, cond.direction);
    }
    case "change_abs": {
      if (prev == null) return false;
      const diff = n(cur) - n(prev);
      return dirCheck(Math.abs(diff), cond.threshold, diff, cond.direction);
    }
    default:
      throw new Error(`Unknown condition type: "${(cond as any).type}"`);
  }
}

// ── Direction check ───────────────────────────────────────────────────────────
function dirCheck(
  magnitude: number,
  threshold: number,
  diff: number,
  direction: "up" | "down" | "any" | undefined,
): boolean {
  if (!direction || direction === "any") return magnitude >= threshold;
  if (direction === "up") return diff >= threshold;
  if (direction === "down") return diff <= -threshold;
  return false;
}

// ── Message builder ───────────────────────────────────────────────────────────
function buildMessage(
  cond: Condition,
  cur: string,
  prev: string | null,
): string {
  if (cond.message) return cond.message;

  const pctStr = (): string => {
    if (prev == null) return "?";
    const pn = n(prev); // ← using shared n(), not duplicated parse
    const cn = n(cur);
    return pn ? (((cn - pn) / Math.abs(pn)) * 100).toFixed(2) + "%" : "?";
  };

  switch (cond.type) {
    case "any_change":
      return `Changed: ${f(prev)} → ${f(cur)}`;
    case "above":
      return `${f(cur)} exceeded ${f(cond.threshold)}`;
    case "above_equal":
      return `${f(cur)} reached or exceeded ${f(cond.threshold)}`;
    case "below":
      return `${f(cur)} dropped below ${f(cond.threshold)}`;
    case "below_equal":
      return `${f(cur)} dropped to or below ${f(cond.threshold)}`;
    case "between":
      return `${f(cur)} is between ${f(cond.lo)} and ${f(cond.hi)}`;
    case "outside":
      return `${f(cur)} outside range ${f(cond.lo)}–${f(cond.hi)}`;
    case "equals":
      return `Value matched: ${f(cur)}`;
    case "not_equals":
      return `Changed to: ${f(cur)}`;
    case "contains":
      return `Contains "${cond.threshold}": ${f(cur)}`;
    case "not_contains":
      return `No longer contains "${cond.threshold}"`;
    case "increases":
      return `Increased: ${f(prev)} → ${f(cur)}`;
    case "decreases":
      return `Decreased: ${f(prev)} → ${f(cur)}`;
    case "count_above":
      return `Count ${f(cur)} exceeded ${f(cond.threshold)}`;
    case "count_below":
      return `Count ${f(cur)} dropped below ${f(cond.threshold)}`;
    case "change_pct":
      return `${pctStr()} change: ${f(prev)} → ${f(cur)}`;
    case "change_abs":
      return `Changed by ${f(n(cur) - n(prev ?? "0"))}: ${f(prev)} → ${f(cur)}`;
    default:
      return `Condition triggered: ${f(cur)}`;
  }
}
