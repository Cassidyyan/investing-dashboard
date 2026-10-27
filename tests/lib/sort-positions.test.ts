import { expect, it } from "vitest";
import { sortPositions, type PositionSortKey } from "@/lib/sort-positions";
import type { PositionView } from "@/lib/types";
function row(symbol: string, value: number | null): PositionView {
  return {
    symbol,
    description: "",
    kind: "stock",
    units: value,
    price: { amount: value, currency: "CAD" },
    value: { amount: value, currency: "CAD" },
    averageCost: { amount: value, currency: "CAD" },
    unrealizedReturn: { amount: value, currency: "CAD" },
  };
}
it.each<PositionSortKey>([
  "quantity",
  "averageCost",
  "price",
  "value",
  "return",
])(
  "sorts %s numerically in both directions with unknown values last",
  (key) => {
    const rows = [
      row("SMALL", 2),
      row("LARGE", 100),
      row("UNKNOWN", null),
      row("LOSS", -10),
      row("ZERO", 0),
    ];
    expect(sortPositions(rows, key, "descending").map((r) => r.symbol)).toEqual(
      ["LARGE", "SMALL", "ZERO", "LOSS", "UNKNOWN"],
    );
    expect(sortPositions(rows, key, "ascending").map((r) => r.symbol)).toEqual([
      "LOSS",
      "ZERO",
      "SMALL",
      "LARGE",
      "UNKNOWN",
    ]);
    expect(rows.map((r) => r.symbol)).toEqual([
      "SMALL",
      "LARGE",
      "UNKNOWN",
      "LOSS",
      "ZERO",
    ]);
  },
);
it("keeps ties stable and retains row identity for logos", () => {
  const first = { ...row("FIRST", 5), rowKey: "first", logoUrl: "/first.png" };
  const second = {
    ...row("SECOND", 5),
    rowKey: "second",
    logoUrl: "/second.png",
  };
  const sorted = sortPositions([first, second], "value", "descending");
  expect(sorted[0]).toBe(first);
  expect(sorted[1]).toBe(second);
  expect(sorted.map((r) => r.rowKey)).toEqual(["first", "second"]);
});
it("treats missing optional amounts and non-finite data as unavailable", () => {
  const missing = row("MISSING", null);
  delete missing.averageCost;
  delete missing.unrealizedReturn;
  const invalid = row("INVALID", NaN);
  const valid = row("VALID", 0);
  expect(
    sortPositions([missing, invalid, valid], "averageCost", "ascending").map(
      (r) => r.symbol,
    ),
  ).toEqual(["VALID", "MISSING", "INVALID"]);
  expect(
    sortPositions([missing, invalid, valid], "return", "descending").map(
      (r) => r.symbol,
    ),
  ).toEqual(["VALID", "MISSING", "INVALID"]);
});
it("sorts net return by amount rather than percentage", () => {
  const a = { ...row("DOLLAR_GAIN", 100), unrealizedReturnPercent: 1 };
  const b = { ...row("PERCENT_GAIN", 10), unrealizedReturnPercent: 50 };
  expect(sortPositions([b, a], "return", "descending")[0].symbol).toBe(
    "DOLLAR_GAIN",
  );
});
