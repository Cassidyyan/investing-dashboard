// Fictional development-only positions for UI checks; never live fallback data.
import { createAccountsPreview } from "./accounts-preview";
import type { PositionView } from "./types";
export const holdingsPreviews = [
  "sample",
  "loading",
  "refreshing",
  "empty",
  "error",
  "hidden",
] as const;
export type HoldingsPreviewState = (typeof holdingsPreviews)[number];
export function createHoldingsPreview(state: HoldingsPreviewState) {
  const data = createAccountsPreview(state);
  if (data.portfolio.accounts.status !== "ok") return data;
  const symbols = [
    "NVDA",
    "AMZN",
    "VFV.TO",
    "BAM.TO",
    "TSLA",
    "SOFI",
    "META",
    "XEQT.TO",
  ];
  data.portfolio.accounts.data = data.portfolio.accounts.data.map(
    (a, index) => ({
      ...a,
      positions: {
        status: "ok" as const,
        data: {
          asOf: "2026-10-27T18:00:00Z",
          rows: symbols
            .filter((_, i) => i % 3 === index)
            .map((symbol, i): PositionView => {
              const currency = symbol.endsWith(".TO") ? "CAD" : "USD",
                price = 100 + i * 20,
                units = 10 + i;
              return {
                instrumentId: `sample-${symbol}`,
                symbol,
                description: `Sample ${symbol} position — invented data`,
                kind:
                  symbol === "VFV.TO" || symbol === "XEQT.TO" ? "etf" : "stock",
                units,
                price: { amount: price, currency },
                value: { amount: units * price, currency },
                averageCost: { amount: 90, currency },
                unrealizedReturn: { amount: (price - 90) * units, currency },
                unrealizedReturnPercent: ((price - 90) / 90) * 100,
              };
            }),
        },
      },
    }),
  );
  const first = data.portfolio.accounts.data[0];
  if (first?.positions.status === "ok")
    first.positions.data.rows.push(
      {
        instrumentId: "sample-call",
        symbol: "NVDA 261218C00100000",
        description: "Sample long call — invented data",
        kind: "option",
        units: 2,
        price: { amount: 2, currency: "USD" },
        value: { amount: 400, currency: "USD" },
        averageCost: { amount: 1.8, currency: "USD" },
        unrealizedReturn: { amount: 40, currency: "USD" },
        unrealizedReturnPercent: (40 / 360) * 100,
        optionDetails: {
          type: "CALL",
          strike: { amount: 100, currency: "USD" },
          expiration: "2026-12-18",
          multiplier: 100,
          underlyingId: "sample-NVDA",
          underlyingSymbol: "NVDA",
          underlyingKind: "stock",
        },
      },
      {
        symbol: "SAMPLE SHORT",
        description: "Invented short position",
        kind: "stock",
        units: -1,
        price: { amount: 10, currency: "USD" },
        value: { amount: -10, currency: "USD" },
      },
      {
        symbol: "SAMPLE MISSING",
        description: "Invented missing price",
        kind: "stock",
        units: 1,
        price: { amount: null, currency: "CAD" },
        value: { amount: null, currency: "CAD" },
      },
    );
  return data;
}
