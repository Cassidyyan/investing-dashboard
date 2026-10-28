// Explicitly invented development/test data. Never a fallback for live failures.
import type { HoldingReturn } from "@/lib/returns/holding-returns";
import { createAccountsPreview } from "./accounts-preview";
export const returnsPreviews = [
  "sample",
  "loading",
  "refreshing",
  "empty",
  "error",
  "hidden",
  "unranked",
  "complete",
] as const;
export function createReturnsPreview(
  state: (typeof returnsPreviews)[number] = "sample",
) {
  const { portfolio } = createAccountsPreview("sample");
  const tickers = [
    "ALPHA",
    "BETA",
    "GAMMA",
    "DELTA",
    "EPSILON",
    "ZETA",
    "ETA",
    "THETA",
    "IOTA",
    "KAPPA",
    "LAMBDA",
    "MU",
  ];
  let rows: HoldingReturn[] = tickers.map((symbol, i) => {
    const profit = i === 6 ? 0 : 1200 - i * 160;
    return {
      key: `${symbol}:CAD`,
      symbol,
      currency: "CAD",
      accounts:
        i === 0
          ? ["Sample TFSA", "Sample RRSP"]
          : [i % 2 ? "Sample RRSP" : "Sample TFSA"],
      firstPurchase: i === 11 ? null : "2024-01-01",
      purchases: 10000,
      realized: profit * 0.6,
      unrealized: profit * 0.4 - 20,
      dividends: 30,
      charges: 10,
      totalProfit: profit,
      returnPercent: profit / 100,
      sales: [{ date: "2026-09-01", units: 5, profit: profit * 0.6 }],
      issues: [],
      notes:
        i === 0
          ? [
              "Historical FX estimate: Bank of Canada daily reference rate on 2026-09-01; reported cash flows converted to security currency.",
            ]
          : [],
    };
  });
  const unranked: HoldingReturn[] = [
    "Missing purchase basis.",
    "Short sale requires reconciliation.",
    "Current share quantity does not reconcile with recorded trades.",
  ].map((issue, i) => ({
    ...rows[i],
    key: `MISSING${i}:CAD`,
    symbol: `MISSING${i}`,
    totalProfit: null,
    returnPercent: null,
    realized: null,
    unrealized: null,
    dividends: 12 + i,
    issues: [issue],
    notes: [],
  }));
  rows.push(...unranked, {
    ...rows[0],
    key: "USD_SAMPLE:USD",
    symbol: "USD_SAMPLE",
    currency: "USD",
    notes: [],
  });
  let issues = [
    "Sample TFSA: Some transactions have no ticker and cannot be attributed. Older history may be missing.",
  ];
  if (state === "complete") {
    rows = rows.filter((r) => r.totalProfit !== null);
    issues = [];
  }
  if (state === "unranked") rows = unranked;
  if (state === "empty") {
    rows = [];
    issues = [];
  }
  if (state === "error") {
    portfolio.connections = {
      status: "ok",
      data: [{ name: "Sample brokerage", status: "Disabled" }],
    };
  }
  const names = Object.fromEntries(
    tickers.slice(0, 8).map((symbol) => [symbol, `Sample ${symbol} company`]),
  );
  return { portfolio, rows, issues, names };
}
