import type { AccountData } from "./types";

export type CurrencyTotals = {
  cad: number | null;
  usd: number | null;
  incomplete: boolean;
  otherCurrencies: string[];
};

// Reconstruct native-currency estimates from cash and positions, never from the
// already-converted account total. Buying power is not an asset to add.
export function accountCurrencyTotals(account: AccountData): CurrencyTotals {
  let cad = 0,
    usd = 0;
  let hasCad = false,
    hasUsd = false;
  let incomplete =
    account.balances.status === "error" ||
    account.positions.status === "error" ||
    account.account.incomplete ||
    account.account.stale;
  const otherCurrencies = new Set<string>();
  function add(amount: number | null, currency: string | null) {
    if (!currency) {
      incomplete = true;
      return;
    }
    if (currency !== "CAD" && currency !== "USD") {
      otherCurrencies.add(currency);
      return;
    }
    if (amount === null || !Number.isFinite(amount)) {
      incomplete = true;
      return;
    }
    if (currency === "CAD") {
      cad += amount;
      hasCad = true;
    } else {
      usd += amount;
      hasUsd = true;
    }
  }
  if (account.balances.status === "ok")
    for (const b of account.balances.data) add(b.cash.amount, b.cash.currency);
  if (account.positions.status === "ok")
    for (const p of account.positions.data.rows) {
      if (p.units === 0 || p.cashEquivalent) continue;
      add(p.value.amount, p.value.currency);
    }
  // An empty API response is not proof that a nonempty account has zero assets.
  if (!hasCad && !hasUsd && !otherCurrencies.size) incomplete = true;
  return {
    cad: hasCad || !incomplete ? cad : null,
    usd: hasUsd || !incomplete ? usd : null,
    incomplete,
    otherCurrencies: [...otherCurrencies],
  };
}

export function portfolioCurrencyTotals(
  accounts: AccountData[],
): CurrencyTotals {
  const rows = accounts.map(accountCurrencyTotals);
  const sum = (key: "cad" | "usd") =>
    rows.some((r) => r[key] !== null)
      ? rows.reduce((total, row) => total + (row[key] ?? 0), 0)
      : null;
  return {
    cad: sum("cad"),
    usd: sum("usd"),
    incomplete: !rows.length || rows.some((r) => r.incomplete),
    otherCurrencies: [...new Set(rows.flatMap((r) => r.otherCurrencies))],
  };
}

// The feed reports CAD per USD, so converting CAD into USD requires division.
export function combinedUsd(
  totals: CurrencyTotals,
  cadPerUsd: number,
): number | null {
  if (
    !Number.isFinite(cadPerUsd) ||
    cadPerUsd <= 0 ||
    totals.cad === null ||
    totals.usd === null
  )
    return null;
  const result = totals.usd + totals.cad / cadPerUsd;
  return Number.isFinite(result) ? result : null;
}
