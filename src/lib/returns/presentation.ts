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
  if (/stale|snapshot|current holdings.*unavailable/i.test(issue))
    return "Snapshot freshness";
  if (/no matching purchase history/i.test(issue)) return "No purchase basis";
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
export function recoveryAction(category: string): string {
  switch (category) {
    case "FX / currency":
      return "Retry the historical rate lookup. If unavailable, obtain the dated brokerage conversion rate; today's rate cannot fill this gap.";
    case "Snapshot freshness":
      return "Check the brokerage connection and refresh after its holdings sync completes. A closed holding can use an older empty snapshot only when completed transaction history proves the position is flat.";
    case "Transfer reconciliation":
      return "Check both accounts' transfer entries and the original purchases. Automatic matching requires one provable share-and-cost path; an external transfer needs original cost records.";
    case "No purchase basis":
      return "Obtain the earlier purchase or transfer-in cost from brokerage activity exports or trade confirmations. A sale without its purchase is not proof of a short sale.";
    case "Corporate action":
      return "Obtain the split or reinvestment statement, including dates, share quantities and cost adjustments.";
    case "Fees / charges":
      return "Use the trade confirmation to verify fees and whether reported cash already includes them; fees must not be counted twice.";
    case "Short sale":
      return "Short-position returns require a separate borrow and closing-cost ledger and are excluded from this long-holdings ranking.";
    case "Trades don’t reconcile":
      return "Compare dated trades and transfers with the brokerage share count. Missing fills or execution ordering need supporting records.";
    default:
      return "Check transaction synchronization and available history coverage, then compare the missing period with a brokerage activity export.";
  }
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
