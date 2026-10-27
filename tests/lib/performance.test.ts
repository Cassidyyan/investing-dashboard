import { expect, it } from "vitest";
import {
  aggregateHistory,
  selectHistoryRange,
  historyChange,
  historyDate,
  calendarToday,
} from "@/lib/performance";
import type { PerformanceAccount } from "@/lib/types";
function account(
  id: string,
  currency: string,
  rows: [string, number][],
): PerformanceAccount {
  return {
    id,
    name: id,
    suffix: "1234",
    history: {
      status: "ok",
      data: {
        currency,
        points: rows.map(([date, value]) => ({ date, value })),
        omittedPoints: 0,
      },
    },
    returns: { status: "ok", data: [] },
  };
}
it("aggregates only shared dates within a currency, without zero-filling missing accounts", () => {
  const result = aggregateHistory([
    account("a", "CAD", [
      ["2026-10-23", 100],
      ["2026-10-26", 110],
    ]),
    account("b", "CAD", [["2026-10-26", 200]]),
    account("c", "USD", [
      ["2026-10-23", 50],
      ["2026-10-26", 60],
    ]),
  ]);
  expect(result.find((g) => g.currency === "CAD")).toMatchObject({
    points: [{ date: "2026-10-26", value: 310 }],
    missingDates: 1,
    accountCount: 2,
  });
  expect(result.find((g) => g.currency === "USD")?.points).toHaveLength(2);
});
it("does not carry values across dates with no shared history", () => {
  const result = aggregateHistory([
    account("a", "CAD", [["2026-10-23", 100]]),
    account("b", "CAD", [["2026-10-26", 200]]),
  ]);
  expect(result[0].points).toEqual([]);
});
it("uses calendar month cutoffs including leap years without fabricating five-year history", () => {
  const points = [
    { date: "2024-02-28", value: 10 },
    { date: "2024-02-29", value: 11 },
    { date: "2024-03-30", value: 12 },
    { date: "2024-04-01", value: 13 },
  ];
  expect(
    selectHistoryRange(points, "1M", "2024-03-31").map((p) => p.date),
  ).toEqual(["2024-02-29", "2024-03-30"]);
  expect(selectHistoryRange(points, "5 Year", "2024-03-31")).toEqual([]);
});
it("shows the latest daily interval and five observed intervals rather than inventing intraday samples", () => {
  const points = Array.from({ length: 9 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    value: i,
  }));
  expect(
    selectHistoryRange(points, "1D", "2026-10-09").map((p) => p.value),
  ).toEqual([7, 8]);
  expect(
    selectHistoryRange(points, "5D", "2026-10-09").map((p) => p.value),
  ).toEqual([3, 4, 5, 6, 7, 8]);
  expect(selectHistoryRange(points, "YTD", "2026-10-09")).toHaveLength(9);
});
it("keeps value change separate from returns and handles zero or negative baselines", () => {
  expect(
    historyChange([
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-02", value: 150 },
    ]),
  ).toEqual({ amount: 50, percent: 50 });
  expect(
    historyChange([
      { date: "2026-01-01", value: 0 },
      { date: "2026-01-02", value: 100 },
    ]),
  ).toEqual({ amount: 100, percent: null });
  expect(
    historyChange([
      { date: "2026-01-01", value: -10 },
      { date: "2026-01-02", value: 100 },
    ]).percent,
  ).toBeNull();
  expect(historyChange([{ date: "2026-01-01", value: 100 }])).toEqual({
    amount: null,
    percent: null,
  });
});
it("uses Toronto's date and rejects invalid history dates", () => {
  expect(calendarToday(new Date("2026-10-27T01:00:00Z"))).toBe("2026-10-26");
  expect(historyDate("2026-02-30")).toBeNull();
  expect(historyDate("invalid")).toBeNull();
  expect(historyDate("2026-10-26T00:00:00Z")).toBe("2026-10-26");
});
