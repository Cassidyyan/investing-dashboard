// Development-only fixtures for layout and state checks. Never a live fallback.
import type { AccountData, Portfolio, Result, ExchangeRate } from "@/lib/types";
export const accountsPreviews = [
  "sample",
  "loading",
  "refreshing",
  "empty",
  "error",
  "hidden",
] as const;
export type AccountsPreviewState = (typeof accountsPreviews)[number];
export function createAccountsPreview(state: AccountsPreviewState): {
  portfolio: Portfolio;
  rate: Result<ExchangeRate>;
} {
  const account = (
    id: string,
    name: string,
    type: string,
    total: number,
    cadCash: number,
    usdCash: number,
    cadStock: number,
    usdStock: number,
  ): AccountData => ({
    account: {
      id,
      name,
      type,
      institution: "Sample brokerage",
      suffix: "•••• 1234",
      value: { amount: total, currency: "CAD" },
      syncedAt: "2026-10-27T18:00:00Z",
      incomplete: false,
      stale: false,
    },
    balances: {
      status: "ok",
      data: [
        {
          cash: { amount: cadCash, currency: "CAD" },
          buyingPower: { amount: cadCash, currency: "CAD" },
        },
        {
          cash: { amount: usdCash, currency: "USD" },
          buyingPower: { amount: usdCash, currency: "USD" },
        },
      ],
    },
    positions: {
      status: "ok",
      data: {
        asOf: "2026-10-27T18:00:00Z",
        rows: [
          {
            symbol: "SAMPLE.CAD",
            kind: "stock",
            description: "Invented CAD holding",
            units: 10,
            price: { amount: cadStock / 10, currency: "CAD" },
            value: { amount: cadStock, currency: "CAD" },
          },
          {
            symbol: "SAMPLE.USD",
            kind: "stock",
            description: "Invented USD holding",
            units: 10,
            price: { amount: usdStock / 10, currency: "USD" },
            value: { amount: usdStock, currency: "USD" },
          },
        ],
      },
    },
    orders: { status: "ok", data: [] },
    activities: { status: "ok", data: { rows: [], total: 0 } },
  });
  return {
    portfolio: {
      configured: true,
      retrievedAt: "2026-10-27T18:59:00Z",
      accounts:
        state === "error"
          ? {
              status: "error",
              message:
                "Sample connection expired. Reconnect to retrieve accounts.",
            }
          : {
              status: "ok",
              data:
                state === "empty"
                  ? []
                  : [
                      account(
                        "sample-tfsa",
                        "Sample TFSA",
                        "TFSA",
                        57400,
                        2400,
                        800,
                        48000,
                        4200,
                      ),
                      account(
                        "sample-rrsp",
                        "Sample RRSP",
                        "RRSP",
                        68000,
                        1000,
                        0,
                        60000,
                        5000,
                      ),
                      account(
                        "sample-invest",
                        "Sample investing account",
                        "Non-registered",
                        30800,
                        600,
                        0,
                        12000,
                        13000,
                      ),
                    ],
            },
      connections: {
        status: "ok",
        data:
          state === "error"
            ? [{ name: "Sample brokerage", status: "Disabled" }]
            : [],
      },
    },
    rate: { status: "ok", data: { cadPerUsd: 1.4, asOf: "2026-10-26" } },
  };
}
