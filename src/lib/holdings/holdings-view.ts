// Presentation over existing normalized values. Prices, costs, returns, and SDK
// valuation rules are not recalculated here. Positive-allocation scope is retained.
import type {
  AccountData,
  ExchangeRate,
  PositionView,
  Result,
} from "@/lib/types";
import { holdingAllocation } from "@/lib/holdings/holdings";
import { industryAllocation } from "@/lib/holdings/industry-allocation";
import { securityIndustry } from "@/lib/holdings/security-industries";
export type HoldingsCurrency = "CAD" | "USD" | "COMBINED_USD";
export type AllocationMode = "industry" | "holding" | "account";
export type HoldingEntry = {
  key: string;
  account: AccountData["account"];
  position: PositionView;
  logoUrl?: string | null;
};
export type AllocationItem = {
  key: string;
  label: string;
  amount: number;
  percent: number;
  color: string;
};
export type ExcludedPosition = {
  key: string;
  symbol: string;
  account: string;
  reason: string;
};
export const displayCurrency = (mode: HoldingsCurrency) =>
  mode === "CAD" ? "CAD" : "USD";
export function flattenHoldings(accounts: AccountData[]): HoldingEntry[] {
  return accounts.flatMap((a) =>
    a.positions.status === "ok"
      ? a.positions.data.rows.map((position, i) => ({
          key: `${a.account.id}-${position.instrumentId || position.symbol}-${i}`,
          account: a.account,
          position,
        }))
      : [],
  );
}
export function holdingColor(key: string) {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `var(--holding-chart-${(hash >>> 0) % 6})`;
}
export const holdingKey = (symbol: string, kind: string) =>
  `holding:${symbol} · ${kind}`;
export function selectedValue(
  p: PositionView,
  mode: HoldingsCurrency,
  rate: Result<ExchangeRate>,
): number | null {
  const { amount, currency } = p.value;
  if (amount === null || !Number.isFinite(amount)) return null;
  if (mode !== "COMBINED_USD") return currency === mode ? amount : null;
  if (currency === "USD") return amount;
  if (
    currency !== "CAD" ||
    rate.status === "error" ||
    !Number.isFinite(rate.data.cadPerUsd) ||
    rate.data.cadPerUsd <= 0
  )
    return null;
  const converted = amount / rate.data.cadPerUsd;
  return Number.isFinite(converted) ? converted : null;
}
export function inCurrency(p: PositionView, mode: HoldingsCurrency) {
  return (
    !p.value.currency ||
    !["CAD", "USD"].includes(p.value.currency) ||
    mode === "COMBINED_USD" ||
    p.value.currency === mode
  );
}
const industryKinds = new Set([
  "stock",
  "adr",
  "etf",
  "cef",
  "mutualfund",
  "other",
]);
export function allocationView(
  accounts: AccountData[],
  mode: HoldingsCurrency,
  category: AllocationMode,
  rate: Result<ExchangeRate>,
) {
  const entries = flattenHoldings(accounts).filter((e) =>
    inCurrency(e.position, mode),
  );
  const excluded: ExcludedPosition[] = [];
  for (const e of entries) {
    const p = e.position;
    const reason =
      p.units === 0
        ? "Zero quantity"
        : category === "industry" &&
            (p.cashEquivalent || !industryKinds.has(p.kind))
          ? "Unsupported in industry scope (cash equivalent, option, crypto, or derivative)"
          : p.value.amount === null || !Number.isFinite(p.value.amount)
            ? "Missing or unsupported valuation"
            : !p.value.currency || !["CAD", "USD"].includes(p.value.currency)
              ? "Missing or unsupported currency"
              : p.value.amount < 0
                ? "Negative value / short position"
                : p.value.amount === 0
                  ? "Zero value"
                  : null;
    if (reason)
      excluded.push({
        key: e.key,
        symbol: p.symbol,
        account: e.account.name,
        reason,
      });
  }
  const failedAccounts = accounts.filter(
    (a) => a.positions.status === "error",
  ).length;
  const valid = entries.filter((e) => !excluded.some((x) => x.key === e.key));
  const needsCad =
    mode === "COMBINED_USD" &&
    valid.some((e) => e.position.value.currency === "CAD");
  const rateUnavailable =
    needsCad &&
    (rate.status === "error" ||
      !Number.isFinite(rate.data.cadPerUsd) ||
      rate.data.cadPerUsd <= 0);
  if (rateUnavailable)
    return {
      items: [] as AllocationItem[],
      total: null,
      excluded,
      failedAccounts,
      error:
        "Combined estimated USD needs the CAD/USD rate. Native CAD and USD views remain available.",
    };
  // Preserve the original combined industry helper, including its precise scope.
  if (category === "industry" && mode === "COMBINED_USD") {
    const source = industryAllocation(accounts, rate);
    if (source.status === "error")
      return {
        items: [] as AllocationItem[],
        total: null,
        excluded,
        failedAccounts,
        error: source.message,
      };
    return {
      items: source.data.groups.map((g) => ({
        key: `industry:${g.label}`,
        label: g.label,
        amount: g.amount,
        percent: g.percent,
        color: holdingColor(`industry:${g.label}`),
      })),
      total: source.data.groups.length ? source.data.total : null,
      excluded,
      failedAccounts,
      error: null,
    };
  }
  const sums = new Map<string, { label: string; amount: number }>();
  if (category === "holding") {
    // Use the existing holding-allocation aggregation, then only apply the
    // existing CAD / CAD-per-USD conversion for the new combined display.
    const original = holdingAllocation(accounts);
    for (const group of original.groups) {
      if (
        !["CAD", "USD"].includes(group.currency) ||
        (mode !== "COMBINED_USD" && group.currency !== mode)
      )
        continue;
      for (const slice of group.slices) {
        const amount =
          mode === "COMBINED_USD" &&
          group.currency === "CAD" &&
          rate.status === "ok"
            ? slice.amount / rate.data.cadPerUsd
            : slice.amount;
        const key = `holding:${slice.label}`;
        sums.set(key, {
          label: slice.label,
          amount: (sums.get(key)?.amount || 0) + amount,
        });
      }
    }
  } else {
    for (const e of valid) {
      const amount = selectedValue(e.position, mode, rate);
      if (amount === null) continue;
      const label =
        category === "account"
          ? e.account.name
          : securityIndustry(e.position.symbol, e.position.kind).industry;
      const key =
        category === "account"
          ? `account:${e.account.id}`
          : `industry:${label}`;
      sums.set(key, { label, amount: (sums.get(key)?.amount || 0) + amount });
    }
  }
  const values = [...sums]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.amount - a.amount);
  const total = values.reduce((sum, v) => sum + v.amount, 0);
  if (!Number.isFinite(total))
    return {
      items: [] as AllocationItem[],
      total: null,
      excluded,
      failedAccounts,
      error: "Allocation values are unavailable.",
    };
  return {
    items: values.map((v) => ({
      ...v,
      percent: total > 0 ? (v.amount / total) * 100 : 0,
      color: holdingColor(v.key),
    })),
    total: values.length ? total : null,
    excluded,
    failedAccounts,
    error: null,
  };
}
