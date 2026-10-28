import { expect, it } from "vitest";
import {
  allocationView,
  flattenHoldings,
  holdingColor,
  selectedValue,
} from "@/lib/holdings/holdings-view";
import { holdingAllocation } from "@/lib/holdings/holdings";
import { industryAllocation } from "@/lib/holdings/industry-allocation";
import { createHoldingsPreview } from "@/dev/previews/holdings-preview";
function fixture() {
  const p = createHoldingsPreview("sample");
  if (p.portfolio.accounts.status !== "ok") throw Error("fixture");
  return { accounts: p.portfolio.accounts.data, rate: p.rate };
}
it("keeps native holding totals identical to the original calculation", () => {
  const { accounts, rate } = fixture(),
    original = holdingAllocation(accounts);
  for (const mode of ["CAD", "USD"] as const) {
    const source = original.groups.find((g) => g.currency === mode)!;
    const view = allocationView(accounts, mode, "holding", rate);
    expect(view.total).toBe(source.total);
    expect(view.items.map((r) => [r.label, r.amount, r.percent])).toEqual(
      source.slices.map((r) => [r.label, r.amount, r.percent]),
    );
  }
});
it("uses the same daily-rate conversion and existing combined industry calculation", () => {
  const { accounts, rate } = fixture();
  if (rate.status !== "ok") throw Error("fixture");
  const native = holdingAllocation(accounts),
    cad = native.groups.find((g) => g.currency === "CAD")!.total,
    usd = native.groups.find((g) => g.currency === "USD")!.total;
  expect(
    allocationView(accounts, "COMBINED_USD", "holding", rate).total,
  ).toBeCloseTo(usd + cad / rate.data.cadPerUsd);
  const source = industryAllocation(accounts, rate);
  if (source.status !== "ok") throw Error("fixture");
  const view = allocationView(accounts, "COMBINED_USD", "industry", rate);
  expect(view.total).toBe(source.data.total);
  expect(view.items.map((r) => [r.label, r.amount, r.percent])).toEqual(
    source.data.groups.map((g) => [g.label, g.amount, g.percent]),
  );
});
it("does not silently drop CAD when the combined rate is unavailable", () => {
  const { accounts } = fixture(),
    rate = { status: "error" as const, message: "Unavailable" };
  expect(
    allocationView(accounts, "COMBINED_USD", "holding", rate),
  ).toMatchObject({ total: null, error: expect.stringContaining("CAD/USD") });
  expect(allocationView(accounts, "CAD", "holding", rate).total).not.toBeNull();
});
it("account grouping keeps the same estimated holdings total, independent of reported account totals", () => {
  const { accounts, rate } = fixture();
  accounts[0].account.value.amount = 99999999;
  expect(
    allocationView(accounts, "COMBINED_USD", "account", rate).total,
  ).toBeCloseTo(
    allocationView(accounts, "COMBINED_USD", "holding", rate).total!,
  );
});
it("lists each excluded position with a reason and keeps real slices instead of an Other bucket", () => {
  const { accounts, rate } = fixture();
  if (accounts[0].positions.status !== "ok") throw Error("fixture");
  accounts[0].positions.data.rows.push({
    ...accounts[0].positions.data.rows[0],
    symbol: "ZERO",
    units: 0,
  });
  const view = allocationView(accounts, "COMBINED_USD", "holding", rate);
  expect(view.excluded.map((e) => e.reason)).toEqual(
    expect.arrayContaining([
      "Negative value / short position",
      "Missing or unsupported valuation",
      "Zero quantity",
    ]),
  );
  expect(view.items.some((e) => e.label === "Other")).toBe(false);
  expect(view.items.length).toBeGreaterThan(6);
  expect(view.items.reduce((s, r) => s + r.percent, 0)).toBeCloseTo(100);
});
it("keeps row values unchanged, makes missing values unavailable, and assigns stable colors", () => {
  const { accounts, rate } = fixture(),
    entries = flattenHoldings(accounts);
  const first = entries[0].position,
    value = first.value.amount;
  selectedValue(first, "COMBINED_USD", rate);
  expect(first.value.amount).toBe(value);
  expect(
    selectedValue(
      { ...first, value: { amount: null, currency: "USD" } },
      "USD",
      rate,
    ),
  ).toBeNull();
  expect(holdingColor("holding:NVDA · stock")).toBe(
    holdingColor("holding:NVDA · stock"),
  );
});
