import { expect, it } from "vitest";
import { holdingAllocation, isOption } from "@/lib/holdings";
import type { AccountData, PositionView } from "@/lib/types";
function position(
  symbol: string,
  amount: number | null,
  currency: string | null,
  kind = "stock",
  units: number | null = 1,
): PositionView {
  return {
    symbol,
    kind,
    description: "",
    units,
    price: { amount: null, currency },
    value: { amount, currency },
  };
}
function account(rows: PositionView[]): AccountData {
  return {
    account: {
      id: "a",
      name: "Account",
      institution: "Test",
      suffix: "1234",
      type: "test",
      value: { amount: null, currency: null },
      syncedAt: null,
      incomplete: false,
      stale: false,
    },
    positions: { status: "ok", data: { rows, asOf: null } },
    balances: { status: "ok", data: [] },
    orders: { status: "ok", data: [] },
    activities: { status: "ok", data: { rows: [], total: 0 } },
  };
}
it("combines matching holdings across accounts without mixing currencies or kinds", () => {
  const allocation = holdingAllocation([
    account([
      position("ABC", 10, "CAD"),
      position("ABC", 30, "USD"),
      position("ABC", 10, "CAD", "option"),
    ]),
    account([position("ABC", 20, "CAD")]),
  ]);
  const cad = allocation.groups.find((g) => g.currency === "CAD")!;
  expect(cad.total).toBe(40);
  expect(cad.slices).toEqual([
    { label: "ABC · stock", amount: 30, percent: 75 },
    { label: "ABC · option", amount: 10, percent: 25 },
  ]);
  expect(allocation.groups.find((g) => g.currency === "USD")?.total).toBe(30);
});
it("excludes shorts, zero values, missing values and currencies, and failed accounts", () => {
  const failed = account([]);
  failed.positions = { status: "error", message: "Unavailable" };
  const allocation = holdingAllocation([
    failed,
    account([
      position("SHORT", -10, "CAD"),
      position("ZERO", 0, "CAD"),
      position("MISSING", null, "CAD"),
      position("CURRENCY", 10, null),
      position("CLOSED", 10, "CAD", "stock", 0),
      position("LONG", 10, "CAD"),
    ]),
  ]);
  expect(allocation.excluded).toBe(4);
  expect(allocation.failedAccounts).toBe(1);
  expect(allocation.groups[0].total).toBe(10);
});
it("recognizes options and futures options separately from other holdings", () => {
  expect(isOption("option")).toBe(true);
  expect(isOption("future_option")).toBe(true);
  expect(isOption("future")).toBe(false);
  expect(isOption("stock")).toBe(false);
});
