// DEVELOPMENT-ONLY MOCK ADAPTER. Never used as fallback for real account data.
import type { OverviewModel, OverviewRange } from "./overview";
export const overviewPreviews = [
  "sample",
  "loading",
  "refreshing",
  "empty",
  "error",
  "hidden",
] as const;
export type OverviewPreview = (typeof overviewPreviews)[number];
export function createOverviewPreview(state: OverviewPreview): OverviewModel {
  const history = Object.fromEntries(
    (["1D", "1W", "1M", "1Y", "All"] as OverviewRange[]).map((range, index) => [
      range,
      Array.from({ length: 24 }, (_, i) => ({
        label: `Sample ${range} point ${i + 1}`,
        value: 140000 + i * 420 + Math.sin(i * 0.8 + index) * 1100,
      })),
    ]),
  ) as NonNullable<OverviewModel["history"]>;
  const value = (amount: number) => ({ amount, currency: "CAD" });
  return {
    configured: true,
    error:
      state === "error" ? "Sample brokerage connection has expired." : null,
    expired: state === "error",
    updatedAt: "2026-10-27T18:59:00Z",
    rate: { cadPerUsd: 1.4, asOf: "2026-10-26" },
    partial: false,
    accounts:
      state === "empty"
        ? []
        : [
            {
              id: "sample-tfsa",
              name: "Sample TFSA",
              value: value(92000),
              dayChange: { amount: 240, percent: 0.26 },
            },
            {
              id: "sample-rrsp",
              name: "Sample RRSP",
              value: value(58000),
              dayChange: { amount: -80, percent: -0.14 },
            },
          ],
    cash: {
      CAD: state === "empty" ? null : 2500,
      USD: state === "empty" ? null : 1200,
      partial: false,
    },
    assets:
      state === "empty"
        ? []
        : [
            { label: "Stocks", value: value(90000) },
            { label: "Funds", value: value(54000) },
            { label: "Cash", value: value(6000) },
          ],
    holdings:
      state === "empty"
        ? []
        : ["SAMPLE A", "SAMPLE B", "SAMPLE C", "SAMPLE D", "SAMPLE E"].map(
            (symbol, i) => ({ symbol, value: value(35000 - i * 5000) }),
          ),
    dayChange: state === "empty" ? null : { amount: 160, percent: 0.11 },
    totalReturn: state === "empty" ? null : { amount: 12500, percent: 9.09 },
    history: state === "empty" ? null : history,
    activity:
      state === "empty"
        ? []
        : Array.from({ length: 5 }, (_, i) => ({
            id: `sample-${i}`,
            label: i % 2 ? "Sample dividend" : "Sample purchase",
            account: "Sample TFSA",
            date: `2026-10-${27 - i}`,
            value: value(i % 2 ? 24.5 : -250),
          })),
    mock: true,
  };
}
