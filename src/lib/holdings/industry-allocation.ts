import type { AccountData, ExchangeRate, Result } from "@/lib/types";
import { securityIndustry } from "@/lib/holdings/security-industries";

type Holding = { symbol: string; kind: string; amount: number; source: string };
export type IndustryGroup = {
  label: string;
  amount: number;
  percent: number;
  holdings: Holding[];
};
export type IndustryAllocation = {
  total: number;
  groups: IndustryGroup[];
  hasCad: boolean;
  excluded: number;
  failedAccounts: number;
  unclassified: string[];
  stale: boolean;
};

export function industryAllocation(
  accounts: AccountData[],
  rate: Result<ExchangeRate>,
): Result<IndustryAllocation> {
  const groups = new Map<string, Map<string, Holding>>();
  const unclassified = new Set<string>();
  let excluded = 0,
    failedAccounts = 0,
    hasCad = false;
  for (const account of accounts) {
    if (account.positions.status === "error") {
      failedAccounts++;
      continue;
    }
    for (const p of account.positions.data.rows) {
      // Cash, options, crypto, and non-equity derivatives are not industry equity exposure.
      if (
        p.units === 0 ||
        p.cashEquivalent ||
        !["stock", "adr", "etf", "cef", "mutualfund", "other"].includes(p.kind)
      )
        continue;
      const { amount, currency } = p.value;
      if (
        amount === null ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !["CAD", "USD"].includes(currency || "")
      ) {
        excluded++;
        continue;
      }
      let usd = amount;
      if (currency === "CAD") {
        hasCad = true;
        if (
          rate.status === "error" ||
          !Number.isFinite(rate.data.cadPerUsd) ||
          rate.data.cadPerUsd <= 0
        )
          return {
            status: "error",
            message:
              "The industry chart needs a CAD/USD rate to combine your holdings. The rate is unavailable; the separate currency charts remain available below.",
          };
        usd = amount / rate.data.cadPerUsd;
      }
      if (!Number.isFinite(usd)) {
        excluded++;
        continue;
      }
      const classification = securityIndustry(p.symbol, p.kind);
      if (!classification.source) unclassified.add(p.symbol);
      const holdings =
        groups.get(classification.industry) ?? new Map<string, Holding>();
      const key = `${p.symbol}|${p.kind}`;
      holdings.set(key, {
        symbol: p.symbol,
        kind: p.kind,
        amount: (holdings.get(key)?.amount ?? 0) + usd,
        source: classification.source,
      });
      groups.set(classification.industry, holdings);
    }
  }
  const entries = [...groups]
    .map(([label, holdings]) => ({
      label,
      amount: [...holdings.values()].reduce((sum, h) => sum + h.amount, 0),
      holdings: [...holdings.values()].sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount);
  const total = entries.reduce((sum, g) => sum + g.amount, 0);
  if (!Number.isFinite(total))
    return {
      status: "error",
      message: "Industry totals could not be calculated safely.",
    };
  return {
    status: "ok",
    data: {
      total,
      groups: entries.map((group) => ({
        ...group,
        percent: total > 0 ? (group.amount / total) * 100 : 0,
      })),
      hasCad,
      excluded,
      failedAccounts,
      unclassified: [...unclassified],
      stale: accounts.some((a) => a.account.stale || a.account.incomplete),
    },
  };
}
