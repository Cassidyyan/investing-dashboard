import { cashMoney, money } from "@/lib/format";
import { expect, it } from "vitest";
import { cashFigureReview, cashSummary, cashSyncInfo } from "@/lib/cash/cash";
import { createCashPreview } from "@/dev/previews/cash-preview";
function accounts() {
  const p = createCashPreview("sample");
  if (p.accounts.status !== "ok") throw Error("fixture");
  return p.accounts.data;
}
it("sums cash in native currencies, not reported totals or buying power", () => {
  const rows = accounts();
  if (rows[0].balances.status !== "ok") throw Error("fixture");
  rows[0].balances.data[0].buyingPower.amount = 1000000;
  expect(cashSummary(rows)).toMatchObject({
    totals: { CAD: 4250, USD: 900 },
    count: 3,
    partial: false,
  });
});
it("preserves known negative cash and marks missing balances partial rather than substituting zero", () => {
  const rows = accounts();
  rows[0].balances = { status: "error", message: "Unavailable" };
  if (rows[1].balances.status !== "ok") throw Error("fixture");
  rows[1].balances.data[0].cash.amount = -50;
  expect(cashSummary(rows)).toMatchObject({
    totals: { CAD: 1750, USD: -50 },
    partial: true,
  });
  expect(cashSummary([]).totals).toEqual({ CAD: null, USD: null });
});
it("flags same-currency differences but does not compare unconverted multi-currency amounts", () => {
  const rows = accounts();
  expect(cashFigureReview(rows[0])).toBe("consistent");
  expect(cashFigureReview(rows[2])).toBe("different");
  if (rows[0].balances.status !== "ok") throw Error("fixture");
  rows[0].balances.data.push({
    cash: { amount: 100, currency: "USD" },
    buyingPower: { amount: null, currency: "USD" },
  });
  expect(cashFigureReview(rows[0])).toBe("multi-currency");
});
it("keeps unavailable figures and unsupported currencies explicit", () => {
  const row = accounts()[0];
  row.balances = { status: "ok", data: [] };
  expect(cashFigureReview(row)).toBe("unavailable");
  expect(cashSummary([row]).partial).toBe(true);
  row.balances = {
    status: "ok",
    data: [
      {
        cash: { amount: 100, currency: "EUR" },
        buyingPower: { amount: null, currency: "EUR" },
      },
    ],
  };
  expect(cashSummary([row])).toMatchObject({
    totals: { CAD: null, USD: null },
    otherCurrencies: ["EUR"],
    partial: true,
  });
});
it("uses one common valid sync timestamp, and exposes row times only when they differ", () => {
  const rows = accounts();
  expect(cashSyncInfo(rows, "2026-10-27T19:00:00Z")).toEqual({
    updatedAt: "2026-10-27T18:00:00Z",
    common: true,
    differing: false,
  });
  rows[1].account.syncedAt = "2026-10-26T18:00:00Z";
  expect(cashSyncInfo(rows, "2026-10-27T19:00:00Z")).toEqual({
    updatedAt: "2026-10-27T19:00:00Z",
    common: false,
    differing: true,
  });
  expect(cashSyncInfo([], "2026-10-27T19:00:00Z").common).toBe(false);
});

it("displays missing USD cash as zero without changing missing values or other money fields", () => {
  const missing = { amount: null, currency: "USD" };
  expect(cashMoney(missing)).toBe("0");
  expect(missing.amount).toBeNull();
  expect(money(missing)).toBe("Unavailable");
  expect(cashMoney({ amount: null, currency: "CAD" })).toBe("Unavailable");
  expect(cashMoney({ amount: 25, currency: "USD" })).toBe(
    money({ amount: 25, currency: "USD" }),
  );
});
