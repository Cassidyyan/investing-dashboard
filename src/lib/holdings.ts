import type { AccountData } from "./types";

export function isOption(kind: string) {
  return kind === "option" || kind === "future_option";
}

// Pie slices use positive market values, grouped only within the same currency.
export function holdingAllocation(accounts: AccountData[]) {
  const groups = new Map<string, Map<string, number>>();
  let excluded = 0;
  let failedAccounts = 0;
  for (const account of accounts) {
    if (account.positions.status === "error") {
      failedAccounts++;
      continue;
    }
    for (const position of account.positions.data.rows) {
      if (position.units === 0) continue;
      const { amount, currency } = position.value;
      if (
        amount === null ||
        !Number.isFinite(amount) ||
        !currency ||
        amount <= 0
      ) {
        excluded++;
        continue;
      }
      const slices = groups.get(currency) ?? new Map<string, number>();
      const label = `${position.symbol} · ${position.kind}`;
      slices.set(label, (slices.get(label) ?? 0) + amount);
      groups.set(currency, slices);
    }
  }
  return {
    excluded,
    failedAccounts,
    groups: [...groups].map(([currency, values]) => {
      const total = [...values.values()].reduce(
        (sum, amount) => sum + amount,
        0,
      );
      return {
        currency,
        total,
        slices: [...values]
          .sort((a, b) => b[1] - a[1])
          .map(([label, amount]) => ({
            label,
            amount,
            percent: (amount / total) * 100,
          })),
      };
    }),
  };
}
