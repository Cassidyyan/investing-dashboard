// Cash presentation only: native currencies are never added together or converted.
import type { AccountData } from "@/lib/types";
export function cashSummary(accounts: AccountData[]) {
  const totals: { CAD: number | null; USD: number | null } = {
    CAD: null,
    USD: null,
  };
  let partial = false;
  const otherCurrencies = new Set<string>();
  for (const a of accounts) {
    if (a.account.stale || a.account.incomplete) partial = true;
    if (a.balances.status === "error") {
      partial = true;
      continue;
    }
    if (!a.balances.data.length) partial = true;
    for (const b of a.balances.data) {
      const { amount, currency } = b.cash;
      if (amount === null || !Number.isFinite(amount) || !currency) {
        partial = true;
        continue;
      }
      if (currency === "CAD" || currency === "USD")
        totals[currency] = (totals[currency] ?? 0) + amount;
      else {
        otherCurrencies.add(currency);
        partial = true;
      }
    }
  }
  return {
    totals,
    partial,
    otherCurrencies: [...otherCurrencies],
    count: accounts.length,
  };
}
export function cashFigureReview(
  account: AccountData,
): "unavailable" | "different" | "multi-currency" | "consistent" {
  if (
    account.balances.status === "error" ||
    !account.balances.data.length ||
    account.account.value.amount === null ||
    !account.account.value.currency
  )
    return "unavailable";
  const rows = account.balances.data.map((b) => b.cash);
  if (
    rows.some(
      (c) => c.amount === null || !Number.isFinite(c.amount) || !c.currency,
    )
  )
    return "unavailable";
  if (
    rows.some(
      (c) => c.currency !== account.account.value.currency && c.amount !== 0,
    )
  )
    return "multi-currency";
  const sameCurrency = rows.filter(
    (c) => c.currency === account.account.value.currency,
  );
  if (!sameCurrency.length) return "unavailable";
  const cash = sameCurrency.reduce((sum, c) => sum + c.amount!, 0);
  return Math.abs(cash - account.account.value.amount) > 0.011
    ? "different"
    : "consistent";
}
export function cashSyncInfo(accounts: AccountData[], retrievedAt: string) {
  const timestamps = accounts.map((a) => a.account.syncedAt);
  const distinct = new Set(timestamps);
  const common =
    timestamps.length > 0 &&
    distinct.size === 1 &&
    timestamps[0] &&
    Number.isFinite(Date.parse(timestamps[0]))
      ? timestamps[0]
      : null;
  return {
    updatedAt: common || retrievedAt,
    differing: distinct.size > 1,
    common: !!common,
  };
}
