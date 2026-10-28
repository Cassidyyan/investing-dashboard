import { expect, it } from "vitest";
import {
  adaptOverview,
  convertOverview,
  presentOverview,
} from "@/lib/overview";
import { createOverviewPreview } from "@/lib/overview-preview";
import type { AccountData, Portfolio } from "@/lib/types";
function account(
  id: string,
  amount: number,
  currency: string,
  cashOnly = false,
): AccountData {
  return {
    cashOnly,
    account: {
      id,
      name: id,
      institution: "Test",
      suffix: "0000",
      type: "investment",
      value: { amount, currency },
      syncedAt: null,
      incomplete: false,
      stale: false,
    },
    balances: {
      status: "ok",
      data: [
        {
          cash: { amount: 10, currency },
          buyingPower: { amount: 20, currency },
        },
      ],
    },
    positions: {
      status: "ok",
      data: {
        rows: [
          {
            symbol: "TEST",
            description: "",
            kind: "stock",
            units: 1,
            price: { amount: 20, currency },
            value: { amount: 20, currency },
          },
        ],
        asOf: null,
      },
    },
    orders: { status: "ok", data: [] },
    activities: { status: "ok", data: { rows: [], total: 0 } },
  };
}
const portfolio = (accounts: AccountData[]): Portfolio => ({
  configured: true,
  retrievedAt: "2026-10-27T12:00:00Z",
  accounts: { status: "ok", data: accounts },
  connections: { status: "ok", data: [] },
});
const rate = {
  status: "ok" as const,
  data: { cadPerUsd: 1.4, asOf: "2026-10-26" },
};
it("uses reported investing totals, banking cash, and no invented returns or activity", () => {
  const model = adaptOverview(
    portfolio([
      account("invest", 140, "CAD"),
      account("bank", 1000, "CAD", true),
    ]),
    rate,
  );
  expect(model.accounts).toHaveLength(1);
  expect(model.cash.CAD).toBe(20);
  expect(presentOverview(model, "CAD").total).toBe(140);
  expect(model.dayChange).toBeNull();
  expect(model.totalReturn).toBeNull();
  expect(model.history).toBeNull();
  expect(model.activity).toBeNull();
  expect(model.mock).toBe(false);
});
it("converts all reported account totals using the same selected currency", () => {
  const model = adaptOverview(
    portfolio([account("cad", 140, "CAD"), account("usd", 100, "USD")]),
    rate,
  );
  expect(presentOverview(model, "CAD").total).toBe(280);
  expect(presentOverview(model, "USD").total).toBe(200);
  expect(presentOverview(model, "USD").holdings[0].value).toBeCloseTo(
    20 + 20 / 1.4,
  );
});
it("does not mix unknown currencies or substitute missing rates", () => {
  expect(
    convertOverview({ amount: 50, currency: "EUR" }, "CAD", rate.data),
  ).toBeNull();
  expect(
    convertOverview({ amount: 50, currency: "CAD" }, "USD", null),
  ).toBeNull();
  const model = adaptOverview(
    portfolio([account("cad", 140, "CAD"), account("usd", 100, "USD")]),
    { status: "error", message: "Unavailable" },
  );
  expect(presentOverview(model, "CAD")).toMatchObject({
    total: 140,
    partial: true,
  });
});
it("avoids double counting cash equivalents and excludes shorts from positive allocation", () => {
  const a = account("invest", 140, "CAD");
  if (a.positions.status !== "ok") throw Error("fixture");
  a.positions.data.rows.push(
    { ...a.positions.data.rows[0], cashEquivalent: true, symbol: "CASH_EQ" },
    {
      ...a.positions.data.rows[0],
      symbol: "SHORT",
      units: -1,
      value: { amount: -20, currency: "CAD" },
    },
  );
  const model = adaptOverview(portfolio([a]), rate),
    view = presentOverview(model, "CAD");
  expect(view.allocation.map((r) => r.label)).toEqual(["Stocks", "Cash"]);
  expect(view.allocation.reduce((sum, r) => sum + r.percent, 0)).toBeCloseTo(
    100,
  );
  expect(view.holdings).toHaveLength(1);
  expect(view.partial).toBe(true);
});
it("keeps empty and failed loads distinct and preserves connection errors", () => {
  const empty = adaptOverview(portfolio([]), rate);
  expect(empty.accounts).toEqual([]);
  expect(presentOverview(empty, "CAD").total).toBeNull();
  const failed = adaptOverview(
    {
      ...portfolio([]),
      accounts: { status: "error", message: "Safe failure" },
      connections: {
        status: "ok",
        data: [{ name: "Test", status: "Disabled" }],
      },
    },
    rate,
  );
  expect(failed.error).toBe("Safe failure");
  expect(failed.expired).toBe(true);
});
it("keeps preview data clearly marked and independent of real data", () => {
  for (const state of [
    "sample",
    "loading",
    "refreshing",
    "empty",
    "error",
    "hidden",
  ] as const)
    expect(createOverviewPreview(state).mock).toBe(true);
  expect(createOverviewPreview("empty").activity).toEqual([]);
  expect(createOverviewPreview("sample").history?.["1M"]).toHaveLength(24);
});
