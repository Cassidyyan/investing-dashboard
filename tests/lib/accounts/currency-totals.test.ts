import { expect, it, vi, afterEach } from "vitest";
import {
  accountCurrencyTotals,
  portfolioCurrencyTotals,
  combinedUsd,
} from "@/lib/accounts/currency-totals";
import { parseExchangeRate, loadExchangeRate } from "@/server/exchange-rate";
import { normalizePositions } from "@/server/normalize";
import type { AccountData, PositionView } from "@/lib/types";
function position(
  amount: number | null,
  currency: string,
  cashEquivalent = false,
): PositionView {
  return {
    symbol: "TEST",
    kind: "stock",
    description: "",
    units: 1,
    price: { amount, currency },
    value: { amount, currency },
    cashEquivalent,
  };
}
function account(): AccountData {
  return {
    account: {
      id: "test",
      name: "Test",
      institution: "Test",
      suffix: "1234",
      type: "Test",
      value: { amount: 9999, currency: "CAD" },
      syncedAt: null,
      incomplete: false,
      stale: false,
    },
    balances: {
      status: "ok",
      data: [
        {
          cash: { amount: 100, currency: "CAD" },
          buyingPower: { amount: 9999, currency: "CAD" },
        },
        {
          cash: { amount: 20, currency: "USD" },
          buyingPower: { amount: 9999, currency: "USD" },
        },
      ],
    },
    positions: {
      status: "ok",
      data: {
        asOf: null,
        rows: [
          position(200, "CAD"),
          position(-10, "USD"),
          position(100, "CAD", true),
        ],
      },
    },
    orders: { status: "ok", data: [] },
    activities: { status: "ok", data: { rows: [], total: 0 } },
  };
}
afterEach(() => vi.unstubAllGlobals());
it("separates native cash and holdings without adding buying power, reported total, or cash equivalents twice", () => {
  expect(accountCurrencyTotals(account())).toEqual({
    cad: 300,
    usd: 10,
    incomplete: false,
    otherCurrencies: [],
  });
  const totals = portfolioCurrencyTotals([account(), account()]);
  expect(totals.cad).toBe(600);
  expect(totals.usd).toBe(20);
  expect(combinedUsd(totals, 1.5)).toBe(420);
});
it("flags failed balances, unknown prices and unsupported currencies", () => {
  const a = account();
  a.balances = { status: "error", message: "Unavailable" };
  if (a.positions.status !== "ok") throw Error();
  a.positions.data.rows.push(position(null, "USD"), position(30, "EUR"));
  const total = accountCurrencyTotals(a);
  expect(total.incomplete).toBe(true);
  expect(total.otherCurrencies).toEqual(["EUR"]);
  expect(total.cad).toBe(200);
  expect(total.usd).toBe(-10);
});
it("does not treat empty or failed account data as known zero", () => {
  const a = account();
  a.balances = { status: "ok", data: [] };
  a.positions = { status: "ok", data: { asOf: null, rows: [] } };
  const totals = accountCurrencyTotals(a);
  expect(totals.cad).toBeNull();
  expect(totals.usd).toBeNull();
  expect(totals.incomplete).toBe(true);
  expect(combinedUsd(totals, 1.4)).toBeNull();
});
it("does not hide negative cash and rejects invalid conversion rates", () => {
  const a = account();
  if (a.balances.status !== "ok") throw Error();
  a.balances.data[0].cash.amount = -100;
  expect(accountCurrencyTotals(a).cad).toBe(100);
  for (const rate of [0, -1, NaN, Infinity])
    expect(combinedUsd(accountCurrencyTotals(a), rate)).toBeNull();
});
it("preserves the cash-equivalent flag supplied by the SDK", () => {
  const p = normalizePositions({
    results: [
      {
        instrument: {
          kind: "stock",
          id: "x",
          symbol: "TEST",
          raw_symbol: "TEST",
        },
        units: "1",
        price: "100",
        currency: "CAD",
        cash_equivalent: true,
      },
    ],
    data_freshness: { as_of: "2026-10-26" },
  });
  expect(p.rows[0].cashEquivalent).toBe(true);
});
const now = Date.parse("2026-10-26T20:00:00Z");
const feed = (value: unknown = "1.4", date = "2026-10-23") => ({
  observations: [{ d: date, FXUSDCAD: { v: value } }],
});
it("parses the last business-day CAD-per-USD rate without reversing its direction", () => {
  expect(parseExchangeRate(feed(), now)).toEqual({
    cadPerUsd: 1.4,
    asOf: "2026-10-23",
  });
  expect(
    combinedUsd(
      { cad: 140, usd: 50, incomplete: false, otherCurrencies: [] },
      1.4,
    ),
  ).toBeCloseTo(150);
});
it("rejects missing, invalid, stale, and future-dated exchange rates", () => {
  for (const input of [
    null,
    {},
    { observations: [] },
    feed(""),
    feed("0"),
    feed("-1"),
    feed("NaN"),
    feed(null),
    feed("1.4", "2026-10-01"),
    feed("1.4", "2026-12-01"),
    feed("1.4", "2026-02-30"),
  ])
    expect(() => parseExchangeRate(input, now)).toThrow();
});
it("reports failed or malformed feeds rather than inventing a rate", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("Network failure")),
  );
  expect((await loadExchangeRate()).status).toBe("error");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ observations: [] }),
    }),
  );
  expect((await loadExchangeRate()).status).toBe("error");
});

it("marks overflowing currency sums unavailable while preserving the other currency", () => {
  const row = account();
  if (row.positions.status !== "ok") throw Error("fixture");
  row.positions.data.rows = [position(1e308, "CAD"), position(1e308, "CAD")];
  expect(accountCurrencyTotals(row)).toMatchObject({
    cad: null,
    usd: 20,
    incomplete: true,
  });
  const one = account();
  one.positions = {
    status: "ok",
    data: { rows: [position(1e308, "CAD")], asOf: null },
  };
  expect(portfolioCurrencyTotals([one, one])).toMatchObject({
    cad: null,
    incomplete: true,
  });
});
