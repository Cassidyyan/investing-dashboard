import { expect, it, vi } from "vitest";
import {
  applyHistoricalReturnRates,
  loadReturnExchangeRates,
  parseHistoricalRates,
  HISTORICAL_FX_NOTE,
} from "@/server/return-exchange-rates";
import type {
  SecurityTransaction,
  TransactionHistory,
} from "@/lib/returns/holding-returns";
const row = (
  currency = "CAD",
  securityCurrency = "USD",
): SecurityTransaction => ({
  id: "test",
  symbol: "TEST",
  type: "BUY",
  date: "2026-10-24",
  order: "2026-10-24T12:00:00Z",
  units: 1,
  amount: -140,
  price: 140,
  fee: 0,
  currency,
  securityCurrency,
  fxConvertible: true,
  issue: "Historical FX required",
});
const histories = (t = row()): TransactionHistory[] => [
  { accountId: "private-account", transactions: [t], issues: [] },
];
it("parses only finite positive historical observations and rejects invalid dates", () => {
  expect(
    parseHistoricalRates({
      observations: [
        { d: "2026-10-23", FXUSDCAD: { v: "1.4" } },
        { d: "2026-02-30", FXUSDCAD: { v: "1.3" } },
        { d: "2026-10-22", FXUSDCAD: { v: "0" } },
        { d: "2026-10-21", FXUSDCAD: { v: "NaN" } },
      ],
    }),
  ).toEqual([{ date: "2026-10-23", cadPerUsd: 1.4 }]);
});
it("converts CAD cash flows into USD using the latest preceding published rate on a weekend", () => {
  const h = histories();
  const [result] = applyHistoricalReturnRates(
    h,
    [
      { date: "2026-10-23", cadPerUsd: 1.4 },
      { date: "2026-10-26", cadPerUsd: 2 },
    ],
    "2026-10-27",
  );
  expect(result.transactions[0]).toMatchObject({
    amount: -100,
    price: 100,
    currency: "USD",
    issue: undefined,
    fxAsOf: "2026-10-23",
    note: HISTORICAL_FX_NOTE,
  });
  expect(h[0].transactions[0].amount).toBe(-140);
});
it("multiplies USD cash flows into CAD and preserves signed dividends and fees", () => {
  const t = {
    ...row("USD", "CAD"),
    type: "DIVIDEND",
    amount: 10,
    price: null,
    fee: 0.5,
  };
  const [h] = applyHistoricalReturnRates(
    histories(t),
    [{ date: "2026-10-23", cadPerUsd: 1.4 }],
    "2026-10-27",
  );
  expect(h.transactions[0]).toMatchObject({
    amount: 14,
    price: null,
    fee: 0.7,
    currency: "CAD",
  });
});
it("never uses future or over-seven-day-old rates, missing amounts, or unsupported currencies", () => {
  const t = row();
  for (const rates of [
    [{ date: "2026-10-26", cadPerUsd: 1.4 }],
    [{ date: "2026-10-01", cadPerUsd: 1.4 }],
    [],
  ])
    expect(
      applyHistoricalReturnRates(histories(t), rates, "2026-10-27")[0]
        .transactions[0],
    ).toBe(t);
  for (const invalid of [
    { ...t, currency: "EUR" },
    { ...t, amount: null },
    { ...t, fxConvertible: false },
    { ...t, date: "2099-01-01" },
  ])
    expect(
      applyHistoricalReturnRates(
        histories(invalid),
        [{ date: "2026-10-23", cadPerUsd: 1.4 }],
        "2026-10-27",
      )[0].transactions[0],
    ).toBe(invalid);
});
it("requests one public date range with no account identifiers or amounts", async () => {
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          observations: [{ d: "2026-10-23", FXUSDCAD: { v: "1.4" } }],
        }),
      ),
  );
  const result = await loadReturnExchangeRates(histories(), fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const url = fetcher.mock.calls[0][0] as string;
  expect(url).toContain("start_date=2026-10-17");
  expect(url).toContain("end_date=2026-10-24");
  expect(url).not.toContain("private-account");
  expect(url).not.toContain("140");
  expect(result.histories[0].transactions[0].amount).toBe(-100);
});
it("does not fetch for native-currency records and preserves errors without a current-rate fallback", async () => {
  const fetcher = vi.fn(async () => {
    throw Error("PRIVATE");
  });
  await loadReturnExchangeRates(
    histories({ ...row(), fxConvertible: false }),
    fetcher,
  );
  expect(fetcher).not.toHaveBeenCalled();
  const h = histories(),
    result = await loadReturnExchangeRates(h, fetcher);
  expect(result.histories).toBe(h);
  expect(result.warnings[0]).toContain("no current-rate fallback");
  expect(JSON.stringify(result.warnings)).not.toContain("PRIVATE");
});

it("reconciles a transfer after historical cash flows are converted without doubling purchase costs", async () => {
  const { calculateHoldingReturns } =
    await import("@/lib/returns/holding-returns");
  const transfer: SecurityTransaction = {
    ...row("USD", "USD"),
    fxConvertible: false,
    issue: undefined,
    id: "transfer",
    type: "TRANSFER",
    units: 10,
    amount: 0,
    date: "2026-10-24",
    order: "2026-10-24T12:00:00Z",
  };
  const source: TransactionHistory = {
    accountId: "source",
    issues: [],
    transactions: [
      {
        ...row(),
        units: 10,
        date: "2026-10-23",
        order: "2026-10-23T12:00:00Z",
      },
      transfer,
    ],
  };
  const destination: TransactionHistory = {
    accountId: "destination",
    issues: [],
    transactions: [
      { ...transfer, id: "incoming" },
      {
        ...transfer,
        id: "sale",
        type: "SELL",
        amount: 60,
        units: 4,
        date: "2026-10-26",
        order: "2026-10-26T12:00:00Z",
      },
    ],
  };
  const account = (id: string, units: number) => ({
    account: {
      id,
      name: id,
      institution: "Test",
      type: "Test",
      suffix: "0000",
      value: { amount: 0, currency: "USD" },
      syncedAt: null,
      incomplete: false,
      stale: false,
    },
    positions: {
      status: "ok" as const,
      data: {
        rows: units
          ? [
              {
                symbol: "TEST",
                kind: "stock",
                description: "",
                units,
                price: { amount: 15, currency: "USD" },
                value: { amount: units * 15, currency: "USD" },
              },
            ]
          : [],
        asOf: null,
      },
    },
    balances: { status: "ok" as const, data: [] },
    orders: { status: "ok" as const, data: [] },
    activities: { status: "ok" as const, data: { rows: [], total: 0 } },
  });
  const converted = applyHistoricalReturnRates(
    [source, destination],
    [{ date: "2026-10-23", cadPerUsd: 1.4 }],
    "2026-10-27",
  );
  const [result] = calculateHoldingReturns(
    [account("source", 0), account("destination", 6)],
    converted,
  );
  expect(result).toMatchObject({
    purchases: 100,
    realized: 20,
    unrealized: 30,
    totalProfit: 50,
    returnPercent: 50,
    issues: [],
  });
  expect(result.notes).toContain(HISTORICAL_FX_NOTE);
  expect(result.sales).toHaveLength(1);
});
