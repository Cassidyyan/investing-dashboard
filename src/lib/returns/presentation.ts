import type { HoldingReturn } from "./holding-returns";
export type ReturnsSort =
  | "profit-desc"
  | "profit-asc"
  | "percent"
  | "realized"
  | "unrealized"
  | "dividends";
export const isRanked = (r: HoldingReturn) =>
  r.totalProfit !== null && r.returnPercent !== null;
export const isFxEstimate = (r: HoldingReturn) =>
  !!r.notes?.some((n) => n.startsWith("Historical FX estimate"));
export function sortReturns(rows: HoldingReturn[], sort: ReturnsSort) {
  return [...rows].sort((a, b) => {
    const field =
      sort === "percent"
        ? "returnPercent"
        : sort === "realized" || sort === "unrealized" || sort === "dividends"
          ? sort
          : "totalProfit";
    const left = a[field],
      right = b[field];
    if (left === null)
      return right === null ? a.symbol.localeCompare(b.symbol) : 1;
    if (right === null) return -1;
    return (
      (sort === "profit-asc" ? left - right : right - left) ||
      a.symbol.localeCompare(b.symbol)
    );
  });
}
export function sumReturns(
  rows: HoldingReturn[],
  field: "totalProfit" | "realized" | "unrealized" | "dividends" | "charges",
) {
  if (!rows.length || rows.some((r) => r[field] === null)) return null;
  const value = rows.reduce((sum, r) => sum + r[field]!, 0);
  return Number.isFinite(value) ? value : null;
}
export function reasonCategory(issue: string) {
  if (/currency|\bfx\b|exchange rate/i.test(issue)) return "FX / currency";
  if (/transfer/i.test(issue)) return "Transfer reconciliation";
  if (/short/i.test(issue)) return "Short sale";
  if (
    /purchase.*missing|missing.*purchase|purchase history|basis|cost.*missing/i.test(
      issue,
    )
  )
    return "No purchase basis";
  if (/split|reinvest|corporate/i.test(issue)) return "Corporate action";
  if (/fee|tax|charge/i.test(issue)) return "Fees / charges";
  if (
    /reconcil|quantity|units|exceed|ordering|order.*uncertain|same.day/i.test(
      issue,
    )
  )
    return "Trades don’t reconcile";
  return "Incomplete history";
}
export function groupedReasons(row: HoldingReturn) {
  const groups = new Map<string, string[]>();
  for (const issue of [...new Set(row.issues)]) {
    const label = reasonCategory(issue);
    groups.set(label, [...(groups.get(label) || []), issue]);
  }
  if (!groups.size)
    groups.set("Incomplete history", [
      "A complete lifetime return is not available.",
    ]);
  return [...groups].map(([label, issues]) => ({ label, issues }));
}
