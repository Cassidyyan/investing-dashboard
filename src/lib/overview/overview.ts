// Adapt current snapshots; optional history is attached by history.ts.
import type { OverviewHistory } from "./history";
import type {
  AccountData,
  ExchangeRate,
  Money,
  Portfolio,
  Result,
} from "@/lib/types";
export type Change = { amount: number; percent: number | null } | null;
export type OverviewRange = "1D" | "1W" | "1M" | "1Y" | "All";
export type OverviewModel = {
  configured: boolean;
  error: string | null;
  expired: boolean;
  updatedAt: string;
  rate: ExchangeRate | null;
  partial: boolean;
  accounts: {
    id: string;
    name: string;
    value: Money;
    dayChange: Change;
    dayChangeCurrency?: string;
    dayChangePeriod?: string;
  }[];
  cashAccounts?: { id: string; name: string; balances: Money[] }[];
  cash: { CAD: number | null; USD: number | null; partial: boolean };
  assets: { label: string; value: Money }[];
  holdings: {
    symbol: string;
    value: Money;
    kind?: string;
    logoUrl?: string | null;
  }[];
  dayChange: Change;
  totalReturn: Change;
  history: Record<OverviewRange, { label: string; value: number }[]> | null;
  historyByCurrency?: Partial<Record<"CAD" | "USD", OverviewHistory>>;
  historyMessage?: string;
  historyIssues?: string[];
  activityMessage?: string;
  activity:
    | {
        id: string;
        label: string;
        account: string;
        date: string;
        value: Money;
      }[]
    | null;
  mock: boolean;
};
export function adaptOverview(
  portfolio: Portfolio,
  rate: Result<ExchangeRate>,
  options: { activitiesLoaded?: boolean } = {},
): OverviewModel {
  const all = portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const investing = all.filter((a) => !a.cashOnly);
  const cash: OverviewModel["cash"] = { CAD: null, USD: null, partial: false };
  const assets: OverviewModel["assets"] = [],
    holdings: OverviewModel["holdings"] = [];
  let partial = investing.some(
    (a) =>
      a.account.stale ||
      a.account.incomplete ||
      a.account.value.amount === null ||
      !a.account.value.currency,
  );
  const assetClass = (kind: string) =>
    ({
      stock: "Stocks",
      adr: "Stocks",
      etf: "Funds",
      cef: "Funds",
      mutualfund: "Funds",
      option: "Options",
      crypto: "Crypto",
    })[kind] || "Other";
  for (const a of all) {
    if (a.balances.status === "ok") {
      if (!a.balances.data.length) cash.partial = true;
      for (const b of a.balances.data) {
        const c = b.cash.currency;
        if ((c === "CAD" || c === "USD") && b.cash.amount !== null)
          cash[c] = (cash[c] ?? 0) + b.cash.amount;
        else cash.partial = true;
        if (!a.cashOnly) assets.push({ label: "Cash", value: b.cash });
      }
    } else {
      cash.partial = true;
      if (!a.cashOnly) partial = true;
    }
    if (a.account.stale || a.account.incomplete) cash.partial = true;
    if (a.cashOnly) continue;
    if (a.positions.status === "error") {
      partial = true;
      continue;
    }
    for (const p of a.positions.data.rows) {
      if (p.units === 0 || p.cashEquivalent) continue;
      if (
        p.value.amount === null ||
        p.value.amount < 0 ||
        p.units === null ||
        p.units < 0
      ) {
        partial = true;
        continue;
      }
      assets.push({ label: assetClass(p.kind), value: p.value });
      holdings.push({ symbol: p.symbol, value: p.value, kind: p.kind });
    }
  }
  const activity: NonNullable<OverviewModel["activity"]> = [];
  let missingActivity = 0;
  if (options.activitiesLoaded)
    for (const a of all) {
      if (a.activities.status === "error") {
        missingActivity++;
        continue;
      }
      for (const [index, row] of a.activities.data.rows.entries()) {
        if (!row.date || !Number.isFinite(Date.parse(row.date))) {
          missingActivity++;
          continue;
        }
        activity.push({
          id: `${a.account.id}-${index}-${row.date}`,
          label: row.description || row.type,
          account: a.account.name,
          date: row.date,
          value: row.amount,
        });
      }
    }
  activity.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return {
    configured: portfolio.configured,
    error:
      portfolio.accounts.status === "error" ? portfolio.accounts.message : null,
    expired:
      portfolio.connections.status === "ok" &&
      portfolio.connections.data.some((c) => c.status === "Disabled"),
    updatedAt: portfolio.retrievedAt,
    rate: rate.status === "ok" ? rate.data : null,
    partial,
    accounts: investing.map((a: AccountData) => ({
      id: a.account.id,
      name: a.account.name,
      value: a.account.value,
      dayChange: null,
    })),
    cash,
    cashAccounts: all.map((a) => ({
      id: a.account.id,
      name: a.account.name,
      balances:
        a.balances.status === "ok" ? a.balances.data.map((b) => b.cash) : [],
    })),
    assets,
    holdings,
    // These fields deliberately do not infer returns from account values or costs.
    dayChange: null,
    totalReturn: null,
    history: null,
    activity:
      options.activitiesLoaded &&
      portfolio.accounts.status === "ok" &&
      (activity.length > 0 || missingActivity === 0)
        ? activity.slice(0, 5)
        : null,
    activityMessage:
      missingActivity > 0
        ? "Some transaction history could not load or has missing dates. Displayed activity is partial."
        : undefined,
    mock: false,
  };
}
export function convertOverview(
  value: Money,
  currency: "CAD" | "USD",
  rate: ExchangeRate | null,
): number | null {
  if (value.amount === null || !Number.isFinite(value.amount)) return null;
  if (value.currency === currency) return value.amount;
  if (!rate || !Number.isFinite(rate.cadPerUsd) || rate.cadPerUsd <= 0)
    return null;
  const converted =
    value.currency === "CAD" && currency === "USD"
      ? value.amount / rate.cadPerUsd
      : value.currency === "USD" && currency === "CAD"
        ? value.amount * rate.cadPerUsd
        : null;
  return converted !== null && Number.isFinite(converted) ? converted : null;
}
export function convertOverviewChange(
  change: Change,
  source: string | null,
  currency: "CAD" | "USD",
  rate: ExchangeRate | null,
): Change {
  if (!change || (change.percent !== null && !Number.isFinite(change.percent)))
    return null;
  const amount = convertOverview(
    { amount: change.amount, currency: source },
    currency,
    rate,
  );
  return amount === null ? null : { amount, percent: change.percent };
}
export function presentOverview(model: OverviewModel, currency: "CAD" | "USD") {
  const totals = model.accounts.map((a) =>
    convertOverview(a.value, currency, model.rate),
  );
  const grouped = (rows: { label: string; value: Money }[]) => {
    const sums = new Map<string, number>();
    let missing = false;
    for (const row of rows) {
      const amount = convertOverview(row.value, currency, model.rate);
      if (amount === null || amount < 0) {
        missing = true;
        continue;
      }
      sums.set(row.label, (sums.get(row.label) || 0) + amount);
    }
    return {
      rows: [...sums]
        .filter(([, value]) => value > 0)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      missing,
    };
  };
  const allocation = grouped(model.assets),
    holdings = grouped(
      model.holdings.map((h) => ({ label: h.symbol, value: h.value })),
    );
  const denominator = allocation.rows.reduce((sum, r) => sum + r.value, 0);
  return {
    total: totals.some((v) => v !== null)
      ? totals.reduce<number>((sum, v) => sum + (v ?? 0), 0)
      : null,
    partial:
      model.partial ||
      totals.some((v) => v === null) ||
      allocation.missing ||
      holdings.missing,
    allocation: allocation.rows.map((r) => ({
      ...r,
      percent: denominator > 0 ? (r.value / denominator) * 100 : 0,
    })),
    holdings: holdings.rows.slice(0, 5).map((row) => ({
      ...row,
      logoUrl:
        model.holdings.find((h) => h.symbol === row.label && h.logoUrl)
          ?.logoUrl ?? null,
    })),
  };
}
