import { describe, it, expect } from "vitest";
import type {
  Account,
  AllAccountPositionsResponse,
} from "snaptrade-typescript-sdk";
import {
  numeric,
  normalizeAccount,
  normalizePositions,
  normalizeBalances,
  normalizeActivities,
} from "@/server/normalize";
import { money, signedPercent, signedMoney } from "@/lib/format";
const position = (
  kind: string,
  extra = {},
  units: string | null = "2",
  price: string | null = "3",
) =>
  ({
    results: [
      {
        instrument: { kind, symbol: "TEST", ...extra },
        units,
        price,
        currency: "CAD",
      },
    ],
    data_freshness: { as_of: "2026-10-26T10:00:00Z" },
  }) as AllAccountPositionsResponse;
describe("financial normalization", () => {
  it("preserves zero and negative amounts without inventing missing values", () => {
    expect(numeric(0)).toBe(0);
    expect(numeric("-12.5")).toBe(-12.5);
    for (const v of [null, undefined, "", " ", Infinity, "NaN", false])
      expect(numeric(v)).toBeNull();
  });
  it("masks account numbers and flags incomplete holdings", () => {
    const a = normalizeAccount({
      id: "a",
      number: "123456789",
      sync_status: { holdings: { initial_sync_completed: false } },
      balance: { total: { amount: 0, currency: "CAD" } },
    } as Account);
    expect(a.suffix).toBe("•••• 6789");
    expect(a.incomplete).toBe(true);
    expect(a.value).toEqual({ amount: 0, currency: "CAD" });
  });
  it("uses option multipliers and preserves short signs", () => {
    const p = normalizePositions(
      position("option", { multiplier: "100" }, "-2"),
    ).rows[0];
    expect(p.value).toEqual({ amount: -600, currency: "CAD" });
  });
  it("values the SDK mutualfund instrument kind", () => {
    expect(
      normalizePositions(position("mutualfund")).rows[0].value.amount,
    ).toBe(6);
  });
  it.each(["adr", "cef"])(
    "values CAD %s positions for allocation and currency totals",
    (kind) => {
      const row = normalizePositions(position(kind, {}, "12.5", "8")).rows[0];
      expect(row.value).toEqual({ amount: 100, currency: "CAD" });
    },
  );
  it("values PHYS.TO CAD trust units but leaves unknown other instruments unavailable", () => {
    const row = normalizePositions(
      position("other", { symbol: "PHYS.TO" }, "10", "20"),
    ).rows[0];
    expect(row.value).toEqual({ amount: 200, currency: "CAD" });
    expect(
      normalizePositions(position("other")).rows[0].value.amount,
    ).toBeNull();
    const wrongCurrency = position("other", { symbol: "PHYS.TO" });
    wrongCurrency.results[0].currency = "USD";
    expect(normalizePositions(wrongCurrency).rows[0].value.amount).toBeNull();
  });
  it("does not infer unsupported valuations or missing prices", () => {
    expect(
      normalizePositions(position("future")).rows[0].value.amount,
    ).toBeNull();
    expect(
      normalizePositions(position("stock", {}, "2", null)).rows[0].value.amount,
    ).toBeNull();
    expect(
      normalizePositions(position("option", { multiplier: null })).rows[0].value
        .amount,
    ).toBeNull();
  });
  it("preserves separate balance currencies and missing cash", () => {
    const rows = normalizeBalances([
      { cash: 0, currency: { code: "CAD" } },
      { cash: null, buying_power: 12, currency: { code: "USD" } },
    ]);
    expect(rows[0].cash).toEqual({ amount: 0, currency: "CAD" });
    expect(rows[1].cash.amount).toBeNull();
    expect(rows[1].buyingPower.currency).toBe("USD");
  });
  it("preserves negative activity amounts and currency", () => {
    expect(
      normalizeActivities({
        data: [{ amount: -10, currency: { code: "EUR" } }],
      }).rows[0].amount,
    ).toEqual({ amount: -10, currency: "EUR" });
  });
  it("formats unknown amounts honestly", () => {
    expect(money({ amount: null, currency: "CAD" })).toBe("Unavailable");
    expect(money({ amount: 12, currency: null })).toContain("currency unknown");
    expect(money({ amount: 12, currency: "CAD" })).toContain("CAD");
  });
});

describe("average cost and unrealized return", () => {
  function withCost(
    kind: string,
    units: string | null,
    price: string | null,
    cost: string | null,
    extra = {},
  ) {
    const data = position(kind, extra, units, price);
    data.results[0].cost_basis = cost;
    return normalizePositions(data).rows[0];
  }
  it("calculates gains for fractional shares using per-share cost", () => {
    const row = withCost("stock", "2.5", "12", "10");
    expect(row.averageCost).toEqual({ amount: 10, currency: "CAD" });
    expect(row.unrealizedReturn).toEqual({ amount: 5, currency: "CAD" });
    expect(row.unrealizedReturnPercent).toBe(20);
  });
  it("preserves losses and reverses the gain direction for short positions", () => {
    expect(withCost("stock", "10", "8", "10").unrealizedReturn?.amount).toBe(
      -20,
    );
    const short = withCost("stock", "-10", "8", "10");
    expect(short.unrealizedReturn?.amount).toBe(20);
    expect(short.unrealizedReturnPercent).toBe(20);
    expect(withCost("stock", "-10", "12", "10").unrealizedReturn?.amount).toBe(
      -20,
    );
  });
  it("applies option multipliers to return dollars without changing percentage", () => {
    const row = withCost("option", "2", "3", "2", { multiplier: "100" });
    expect(row.unrealizedReturn?.amount).toBe(200);
    expect(row.unrealizedReturnPercent).toBe(50);
  });
  it("keeps zero cost as zero but leaves its percentage unavailable", () => {
    const row = withCost("stock", "10", "2", "0");
    expect(row.averageCost?.amount).toBe(0);
    expect(row.unrealizedReturn?.amount).toBe(20);
    expect(row.unrealizedReturnPercent).toBeNull();
  });
  it("does not invent return data for missing inputs or unsupported valuations", () => {
    for (const row of [
      withCost("stock", "2", "3", null),
      withCost("stock", "2", null, "1"),
      withCost("stock", null, "3", "1"),
      withCost("future", "2", "3", "1"),
      withCost("option", "2", "3", "1"),
      withCost("stock", "2", "3", "-1"),
    ]) {
      expect(row.unrealizedReturn?.amount).toBeNull();
      expect(row.unrealizedReturnPercent).toBeNull();
    }
  });
  it("marks a worthless long holding as a full loss, and preserves currency", () => {
    const data = position("stock", {}, "5", "0");
    data.results[0].cost_basis = "20";
    data.results[0].currency = "USD";
    const row = normalizePositions(data).rows[0];
    expect(row.unrealizedReturn).toEqual({ amount: -100, currency: "USD" });
    expect(row.unrealizedReturnPercent).toBe(-100);
  });
  it("formats return signs and missing percentages without presenting zero as a gain", () => {
    expect(signedPercent(20)).toBe("+20.00%");
    expect(signedPercent(-20)).toBe("-20.00%");
    expect(signedPercent(0)).toBe("0.00%");
    expect(signedPercent(null)).toBe("Unavailable");
    expect(signedMoney({ amount: 20, currency: "CAD" })).toContain("+");
    expect(signedMoney({ amount: null, currency: "CAD" })).toBe("Unavailable");
  });
});

it("rejects negative option multipliers and negative security prices instead of reversing valuation signs", () => {
  expect(
    normalizePositions(position("option", { multiplier: "-100" }, "-2")).rows[0]
      .value.amount,
  ).toBeNull();
  expect(
    normalizePositions(position("stock", {}, "-2", "-3")).rows[0].value.amount,
  ).toBeNull();
});
it("projects exact fractional position calculations into the existing view model", () => {
  const data = position("stock", {}, "3", "0.1");
  data.results[0].cost_basis = "0.03";
  const row = normalizePositions(data).rows[0];
  expect(row.value.amount).toBe(0.3);
  expect(row.unrealizedReturn?.amount).toBe(0.21);
});
it("flags malformed synchronization timestamps instead of presenting them as fresh", () => {
  const a = normalizeAccount({
    id: "synthetic",
    sync_status: { holdings: { last_successful_sync: "invalid" } },
  } as Account);
  expect(a.syncedAt).toBeNull();
  expect(a.incomplete).toBe(true);
});
it("keeps missing record arrays distinct from confirmed empty arrays", async () => {
  const { normalizeOrders } = await import("@/server/normalize");
  expect(() => normalizeOrders({})).toThrow("unavailable");
  expect(() => normalizeActivities({})).toThrow("unavailable");
  expect(normalizeOrders({ orders: [] })).toEqual([]);
  expect(normalizeActivities({ data: [] }).rows).toEqual([]);
});
it("preserves recent-first activity ordering and the ticker description fallback", () => {
  const result = normalizeActivities({
    data: [
      {
        id: "older",
        type: "BUY",
        symbol: { symbol: "SYNTH" },
        trade_date: "2026-10-01",
      },
      {
        id: "newer",
        description: "Synthetic dividend",
        type: "DIVIDEND",
        trade_date: "2026-10-02",
      },
    ],
  });
  expect(result.rows.map((row) => row.description)).toEqual([
    "Synthetic dividend",
    "SYNTH",
  ]);
});
