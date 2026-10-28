import { expect, it, vi } from "vitest";
import {
  loadHoldingTransactions,
  normalizeSecurityTransaction,
} from "@/server/load-holding-returns";
import type { ReadClient } from "@/server/snaptrade";
import type { AccountData } from "@/lib/types";
const accounts = [
  { account: { id: "a" } },
  { account: { id: "b" } },
] as AccountData[];
const raw = (id: string) => ({
  id,
  symbol: { symbol: "TEST", type: { code: "cs" }, currency: { code: "CAD" } },
  type: "BUY",
  currency: { code: "CAD" },
  amount: -10,
  price: 10,
  units: 1,
  fee: 0,
  trade_date: "2026-01-01T15:00:00Z",
});
const client = (request: ReturnType<typeof vi.fn>) =>
  ({ transactionPage: request }) as unknown as Pick<
    ReadClient,
    "transactionPage"
  >;
it("reads all pages without a date filter and keeps fully sold history", async () => {
  const request = vi.fn(async (_id, offset) => ({
    data: {
      data:
        offset === 0
          ? Array.from({ length: 1000 }, (_, i) => raw(String(i)))
          : [raw("1000")],
      pagination: { total: 1001 },
    },
  }));
  const [h] = await loadHoldingTransactions(
    accounts.slice(0, 1),
    client(request),
  );
  expect(h.transactions).toHaveLength(1001);
  expect(h.issues).toEqual([]);
  expect(request.mock.calls).toEqual([
    ["a", 0, 1000],
    ["a", 1000, 1000],
  ]);
});
it("preserves other accounts after failure without exposing upstream messages", async () => {
  const request = vi.fn(async (id) => {
    if (id === "a") throw Error("SECRET");
    return { data: { data: [raw("b")], pagination: { total: 1 } } };
  });
  const result = await loadHoldingTransactions(accounts, client(request));
  expect(result[0].issues).toHaveLength(1);
  expect(result[1].transactions).toHaveLength(1);
  expect(JSON.stringify(result)).not.toContain("SECRET");
});
it("deduplicates repeated IDs and excludes the affected history from ranking", async () => {
  const request = vi.fn(async () => ({
    data: { data: [raw("same"), raw("same")], pagination: { total: 2 } },
  }));
  const [h] = await loadHoldingTransactions(
    accounts.slice(0, 1),
    client(request),
  );
  expect(h.transactions).toHaveLength(1);
  expect(h.issues.join(" ")).toContain("repeated");
});
it("flags incomplete pagination and unassigned security transactions", async () => {
  const request = vi.fn(async () => ({
    data: { data: [{ id: "x", type: "DIVIDEND" }], pagination: { total: 5 } },
  }));
  const [h] = await loadHoldingTransactions(
    accounts.slice(0, 1),
    client(request),
  );
  expect(h.warnings?.join(" ")).toContain("attributed");
  expect(h.issues.join(" ")).toContain("incomplete");
});
it("ignores option transactions and validates dates and settlement currency", () => {
  expect(
    normalizeSecurityTransaction({ ...raw("a"), option_type: "BUY_TO_OPEN" }),
  ).toBeNull();
  expect(
    normalizeSecurityTransaction({
      ...raw("a"),
      trade_date: "2026-02-30",
      currency: { code: "USD" },
    }),
  ).toMatchObject({
    date: null,
    currency: "USD",
    issue: expect.stringContaining("FX"),
  });
});

it("stops requesting further histories after a 429", async () => {
  const request = vi.fn(async () => {
    throw { response: { status: 429, data: "PRIVATE" } };
  });
  const result = await loadHoldingTransactions(accounts, client(request));
  expect(request).toHaveBeenCalledTimes(1);
  expect(result[0].issues.join(" ")).toContain("rate limit");
  expect(result[1].issues.join(" ")).toContain("not requested");
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});

it("normalizes signed brokerage sales without changing reported proceeds", () => {
  const sell = normalizeSecurityTransaction({
    ...raw("sale"),
    type: "SELL",
    units: -2.5,
    amount: 45,
    price: 18,
  });
  expect(sell).toMatchObject({
    type: "SELL",
    units: 2.5,
    amount: 45,
    price: 18,
  });
  expect(
    normalizeSecurityTransaction({
      ...raw("sale"),
      type: "SELL",
      units: 2.5,
      amount: 45,
    })?.units,
  ).toBe(2.5);
});
it("does not attribute option lifecycle events or interest to stock returns", () => {
  for (const type of [
    "OPTIONEXPIRATION",
    "OPTIONS_SETTLEMENTS",
    "OPTIONS_ASSIGN",
    "INTEREST",
  ]) {
    expect(
      normalizeSecurityTransaction({ ...raw("option-event"), type }),
    ).toBeNull();
  }
});
it("warns about unmatched tickers without invalidating unrelated matched records", async () => {
  const request = vi.fn(async () => ({
    data: {
      data: [raw("buy"), { id: "unmapped", type: "TRANSFER" }],
      pagination: { total: 2 },
    },
  }));
  const [h] = await loadHoldingTransactions(
    accounts.slice(0, 1),
    client(request),
  );
  expect(h.transactions).toHaveLength(1);
  expect(h.issues).toEqual([]);
  expect(h.warnings).toHaveLength(1);
});

it("uses security currency for zero-cash share transfers without applying a fabricated FX rate", () => {
  const row = normalizeSecurityTransaction({
    ...raw("transfer"),
    type: "TRANSFER",
    amount: 0,
    currency: { code: "CAD" },
    symbol: { ...raw("transfer").symbol, currency: { code: "USD" } },
  });
  expect(row).toMatchObject({
    currency: "USD",
    amount: 0,
    type: "TRANSFER",
    issue: undefined,
  });
  const cash = normalizeSecurityTransaction({
    ...raw("transfer"),
    type: "TRANSFER",
    amount: 100,
    currency: { code: "CAD" },
    symbol: { ...raw("transfer").symbol, currency: { code: "USD" } },
  });
  expect(cash?.issue).toContain("FX reconciliation");
});
