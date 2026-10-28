import { expect, it } from "vitest";
import { normalizePositions } from "@/server/normalize";
import {
  expirationDate,
  daysToExpiration,
  findUnderlyingPrice,
  moneyness,
} from "@/lib/options/option-details";
import type { AccountData, PositionView } from "@/lib/types";
const now = Date.parse("2026-10-26T18:00:00Z");
function option(): PositionView {
  return normalizePositions({
    results: [
      {
        instrument: {
          kind: "option",
          id: "option-id",
          symbol: "TEST  261120C00100000",
          option_type: "CALL",
          strike_price: "100",
          expiration_date: "2026-11-20",
          multiplier: "100",
          underlying: {
            kind: "stock",
            id: "underlying-id",
            symbol: "TEST",
            raw_symbol: "TEST",
            currency: "USD",
          },
        },
        units: "2",
        price: "3",
        currency: "USD",
      },
    ],
    data_freshness: { as_of: "2026-10-26T17:00:00Z" },
  }).rows[0];
}
function account(position: PositionView): AccountData {
  return {
    account: {
      id: "a",
      name: "Test",
      suffix: "1234",
      institution: "Test",
      type: "Test",
      value: { amount: 100, currency: "USD" },
      syncedAt: null,
      incomplete: false,
      stale: false,
    },
    positions: {
      status: "ok",
      data: { asOf: "2026-10-26T17:00:00Z", rows: [position] },
    },
    balances: { status: "ok", data: [] },
    orders: { status: "ok", data: [] },
    activities: { status: "ok", data: { rows: [], total: 0 } },
  };
}
const stock = (): PositionView => ({
  instrumentId: "underlying-id",
  symbol: "TEST",
  description: "Test",
  kind: "stock",
  units: 1,
  price: { amount: 105, currency: "USD" },
  value: { amount: 105, currency: "USD" },
});
it("preserves contract identity, strike, expiry, multiplier and underlying metadata", () => {
  expect(option().optionDetails).toEqual({
    type: "CALL",
    strike: { amount: 100, currency: "USD" },
    expiration: "2026-11-20",
    multiplier: 100,
    underlyingId: "underlying-id",
    underlyingSymbol: "TEST",
    underlyingKind: "stock",
  });
  expect(option().instrumentId).toBe("option-id");
});
it("counts calendar days in Toronto without treating a date-only expiry as UTC market close", () => {
  expect(daysToExpiration("2026-11-20", new Date(now))).toBe(25);
  expect(daysToExpiration("2026-10-26", new Date(now))).toBe(0);
  expect(daysToExpiration("2026-10-25", new Date(now))).toBe(-1);
  expect(daysToExpiration("2026-10-26", new Date("2026-10-27T01:00:00Z"))).toBe(
    0,
  );
  expect(daysToExpiration("2026-11-02", new Date("2026-11-01T04:30:00Z"))).toBe(
    1,
  );
});
it("rejects invalid expiry dates and handles API timestamps", () => {
  expect(expirationDate("2026-11-20T00:00:00Z")).toBe("2026-11-20");
  for (const raw of [null, "invalid", "2026-02-30"])
    expect(expirationDate(raw)).toBeNull();
});
it("classifies calls and puts with an explicit half-percent ATM band", () => {
  expect(moneyness("CALL", 100, 105, 10)).toBe("In the money");
  expect(moneyness("PUT", 100, 105, 10)).toBe("Out of the money");
  expect(moneyness("PUT", 100, 95, 10)).toBe("In the money");
  expect(moneyness("CALL", 100, 95, 10)).toBe("Out of the money");
  expect(moneyness("CALL", 100, 100.5, 10)).toBe("At the money");
  expect(moneyness("PUT", 100, 99.5, 10)).toBe("At the money");
  expect(moneyness("CALL", 100, 105, -1)).toBe("Expired");
  expect(moneyness("CALL", 100, null, 10)).toBe("Unavailable");
  expect(moneyness(null, 100, 105, 10)).toBe("Unavailable");
});
it("uses matching held underlying prices rather than option premiums", () => {
  const price = findUnderlyingPrice(
    option(),
    [account(option()), account(stock())],
    now,
  );
  expect(price?.price).toEqual({ amount: 105, currency: "USD" });
  expect(findUnderlyingPrice(option(), [account(option())], now)).toBeNull();
});
it("rejects wrong currencies, different instruments, unknown timestamps and stale underlying prices", () => {
  for (const mutate of [
    (a: AccountData) => {
      a.account.stale = true;
    },
    (a: AccountData) => {
      a.account.incomplete = true;
    },
    (a: AccountData) => {
      if (a.positions.status === "ok") a.positions.data.asOf = null;
    },
    (a: AccountData) => {
      if (a.positions.status === "ok")
        a.positions.data.asOf = "2026-10-20T00:00:00Z";
    },
    (a: AccountData) => {
      if (a.positions.status === "ok")
        a.positions.data.rows[0].price.currency = "CAD";
    },
    (a: AccountData) => {
      if (a.positions.status === "ok")
        a.positions.data.rows[0].instrumentId = "other-id";
    },
  ]) {
    const a = account(stock());
    mutate(a);
    expect(findUnderlyingPrice(option(), [a], now)).toBeNull();
  }
});
