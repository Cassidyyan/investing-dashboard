import { expect, it } from "vitest";
import {
  calculateHoldingReturns,
  type SecurityTransaction,
  type TransactionHistory,
} from "@/lib/returns/holding-returns";
import type { AccountData, PositionView } from "@/lib/types";
const position = (
  units: number,
  value: number,
  symbol = "TEST",
  currency = "CAD",
): PositionView => ({
  symbol,
  description: "",
  kind: "stock",
  units,
  price: { amount: units ? value / units : 0, currency },
  value: { amount: value, currency },
});
function account(id = "a", positions: PositionView[] = []): AccountData {
  return {
    account: {
      id,
      name: id,
      institution: "Test",
      suffix: "0000",
      type: "investment",
      value: { amount: 0, currency: "CAD" },
      syncedAt: null,
      incomplete: false,
      stale: false,
    },
    positions: { status: "ok", data: { rows: positions, asOf: null } },
    balances: { status: "ok", data: [] },
    orders: { status: "ok", data: [] },
    activities: { status: "ok", data: { rows: [], total: 0 } },
  };
}
function trade(
  type: string,
  units: number,
  amount: number,
  day: number,
  symbol = "TEST",
  currency = "CAD",
): SecurityTransaction {
  const date = `2026-01-${String(day).padStart(2, "0")}`;
  return {
    id: `${type}-${day}`,
    symbol,
    currency,
    date,
    order: `${date}T15:00:00Z`,
    type,
    units,
    amount,
    price: units ? Math.abs(amount / units) : 0,
    fee: 0,
  };
}
const history = (
  transactions: SecurityTransaction[],
  accountId = "a",
  issues: string[] = [],
): TransactionHistory => ({ accountId, transactions, issues });
it("includes winning and losing sales, open gains, dividends, and attributed charges", () => {
  const rows = calculateHoldingReturns(
    [account("a", [position(5, 75)])],
    [
      history([
        trade("BUY", 10, -100, 1),
        trade("SELL", 2, 30, 2),
        trade("SELL", 3, 15, 3),
        trade("DIVIDEND", 0, 8, 4),
        trade("TAX", 0, -2, 5),
      ]),
    ],
  );
  expect(rows[0]).toMatchObject({
    purchases: 100,
    realized: -5,
    unrealized: 25,
    dividends: 8,
    charges: 2,
    totalProfit: 26,
    returnPercent: 26,
    issues: [],
  });
  expect(rows[0].sales.map((s) => s.profit)).toEqual([10, -15]);
});
it("retains fully sold holdings and uses average basis over repeat purchases", () => {
  const rows = calculateHoldingReturns(
    [account()],
    [
      history([
        trade("BUY", 5, -50, 1),
        trade("BUY", 5, -150, 2),
        trade("SELL", 10, 300, 3),
        trade("BUY", 1, -50, 4),
        trade("SELL", 1, 60, 5),
        trade("DIVIDEND", 0, 10, 6),
      ]),
    ],
  );
  expect(rows[0]).toMatchObject({
    purchases: 250,
    realized: 110,
    unrealized: 0,
    totalProfit: 120,
    returnPercent: 48,
    issues: [],
  });
});
it("matches basis separately per account before aggregating the same stock", () => {
  const rows = calculateHoldingReturns(
    [account("a", [position(1, 30)]), account("b")],
    [
      history([trade("BUY", 1, -10, 1)]),
      history([trade("BUY", 1, -20, 1), trade("SELL", 1, 25, 2)], "b"),
    ],
  );
  expect(rows[0]).toMatchObject({
    purchases: 30,
    realized: 5,
    unrealized: 20,
    totalProfit: 25,
    accounts: ["a", "b"],
  });
});
it("does not treat a sale with missing purchase history as pure profit", () => {
  expect(
    calculateHoldingReturns(
      [account()],
      [history([trade("SELL", 10, 300, 3)])],
    )[0].totalProfit,
  ).toBeNull();
});
it("excludes transfers, splits, reinvestment, unknown events and nonzero fees from ranking", () => {
  for (const type of [
    "TRANSFER",
    "SPLIT",
    "REI",
    "STOCK_DIVIDEND",
    "UNKNOWN",
  ]) {
    const rows = calculateHoldingReturns(
      [account("a", [position(1, 20)])],
      [history([trade("BUY", 1, -10, 1), trade(type, 0, 0, 2)])],
    );
    expect(rows[0].totalProfit).toBeNull();
  }
  const t = { ...trade("BUY", 1, -10, 1), fee: 1 };
  expect(
    calculateHoldingReturns(
      [account("a", [position(1, 20)])],
      [history([t])],
    )[0].totalProfit,
  ).toBeNull();
});
it("blocks mismatched shares, missing valuations, stale accounts and failed history", () => {
  const held = account("a", [position(2, 20)]);
  expect(
    calculateHoldingReturns([held], [history([trade("BUY", 1, -10, 1)])])[0]
      .totalProfit,
  ).toBeNull();
  held.positions = { status: "error", message: "Unavailable" };
  expect(
    calculateHoldingReturns(
      [held],
      [history([trade("BUY", 1, -10, 1), trade("SELL", 1, 20, 2)])],
    )[0].totalProfit,
  ).toBeNull();
  expect(
    calculateHoldingReturns(
      [account("a", [position(1, 20)])],
      [history([trade("BUY", 1, -10, 1)], "a", ["Incomplete"])],
    )[0].totalProfit,
  ).toBeNull();
  const stale = account("a", [position(1, 20)]);
  stale.account.stale = true;
  expect(
    calculateHoldingReturns([stale], [history([trade("BUY", 1, -10, 1)])])[0]
      .totalProfit,
  ).toBeNull();
});
it("keeps CAD and USD stocks separate and blocks cross-currency settlement", () => {
  const rows = calculateHoldingReturns(
    [account("a", [position(1, 20), position(1, 50, "OTHER", "USD")])],
    [
      history([
        trade("BUY", 1, -10, 1),
        trade("BUY", 1, -25, 1, "OTHER", "USD"),
      ]),
    ],
  );
  expect(rows.map((r) => [r.currency, r.totalProfit])).toEqual([
    ["CAD", 10],
    ["USD", 25],
  ]);
  const mixed = calculateHoldingReturns(
    [account("a", [position(1, 20)])],
    [history([trade("BUY", 1, -10, 1, "TEST", "USD")])],
  );
  expect(mixed.every((r) => r.totalProfit === null)).toBe(true);
});
it("does not guess buy/sell order for day-only timestamps", () => {
  const buy = trade("BUY", 1, -10, 1),
    sell = trade("SELL", 1, 20, 1);
  buy.order = buy.date!;
  sell.order = sell.date!;
  expect(
    calculateHoldingReturns([account()], [history([sell, buy])])[0].totalProfit,
  ).toBeNull();
});

it("uses known cash flows without requiring a redundant trade price", () => {
  const buy = { ...trade("BUY", 2, -20, 1), price: null };
  const sell = { ...trade("SELL", 1, 15, 2), price: null };
  const [row] = calculateHoldingReturns(
    [account("a", [position(1, 15)])],
    [history([buy, sell])],
  );
  expect(row).toMatchObject({
    realized: 5,
    unrealized: 5,
    totalProfit: 10,
    returnPercent: 50,
    issues: [],
  });
});
it("keeps matched returns available with explicit unassigned-history warnings", () => {
  const h = {
    ...history([trade("BUY", 1, -10, 1)]),
    warnings: ["Unmatched transfer cannot be attributed."],
  };
  const [row] = calculateHoldingReturns([account("a", [position(1, 20)])], [h]);
  expect(row.totalProfit).toBe(10);
});

it("carries original cost across matched internal transfers without counting another purchase or profitable sale", () => {
  const source = history(
    [trade("BUY", 10, -100, 1), trade("TRANSFER", 10, 0, 2)],
    "source",
  );
  const destination = history(
    [trade("TRANSFER", 10, 0, 2), trade("SELL", 4, 60, 3)],
    "destination",
  );
  const [row] = calculateHoldingReturns(
    [account("destination", [position(6, 90)]), account("source")],
    [source, destination],
  );
  expect(row).toMatchObject({
    purchases: 100,
    realized: 20,
    unrealized: 30,
    totalProfit: 50,
    returnPercent: 50,
    firstPurchase: "2026-01-01",
    issues: [],
  });
  expect(row.sales).toHaveLength(1);
  expect(row.notes?.join(" ")).toContain("original recorded purchase cost");
  expect(source.transactions[1].type).toBe("TRANSFER");
});
it("reconciles partial transfers and keeps later purchases and sales at their recorded cost", () => {
  const [row] = calculateHoldingReturns(
    [
      account("source", [position(6, 180)]),
      account("destination", [position(3, 90)]),
    ],
    [
      history(
        [trade("BUY", 10, -100, 1), trade("TRANSFER", 4, 0, 2)],
        "source",
      ),
      history(
        [
          trade("TRANSFER", 4, 0, 2),
          trade("BUY", 2, -40, 3),
          trade("SELL", 3, 90, 4),
        ],
        "destination",
      ),
    ],
  );
  expect(row).toMatchObject({
    purchases: 140,
    realized: 50,
    unrealized: 170,
    totalProfit: 220,
    issues: [],
  });
  expect(row.returnPercent).toBeCloseTo((220 / 140) * 100);
});
it("retains gains from earlier real sales while transferring the remaining basis", () => {
  const [row] = calculateHoldingReturns(
    [account("source"), account("destination", [position(8, 120)])],
    [
      history(
        [
          trade("BUY", 10, -100, 1),
          trade("SELL", 2, 30, 2),
          trade("TRANSFER", 8, 0, 3),
        ],
        "source",
      ),
      history([trade("TRANSFER", 8, 0, 3)], "destination"),
    ],
  );
  expect(row).toMatchObject({
    purchases: 100,
    realized: 10,
    unrealized: 40,
    totalProfit: 50,
    issues: [],
  });
  expect(row.sales).toHaveLength(1);
});
it("does not guess transfer direction when ending quantities do not prove both legs", () => {
  const rows = calculateHoldingReturns(
    [
      account("source", [position(5, 50)]),
      account("destination", [position(10, 100)]),
    ],
    [
      history(
        [trade("BUY", 10, -100, 1), trade("TRANSFER", 10, 0, 2)],
        "source",
      ),
      history([trade("TRANSFER", 10, 0, 2)], "destination"),
    ],
  );
  expect(rows[0].totalProfit).toBeNull();
  expect(rows[0].notes || []).toEqual([]);
});
it("rejects ambiguous transfer pairs, stale snapshots, and same-day trade ordering", () => {
  const h = [
    history([trade("BUY", 10, -100, 1), trade("TRANSFER", 10, 0, 2)], "source"),
    history([trade("TRANSFER", 10, 0, 2)], "destination"),
  ];
  const stale = account("source");
  stale.account.stale = true;
  expect(
    calculateHoldingReturns(
      [stale, account("destination", [position(10, 120)])],
      h,
    )[0].totalProfit,
  ).toBeNull();
  expect(
    calculateHoldingReturns(
      [
        account("source"),
        account("destination", [position(10, 120)]),
        account("third", [position(10, 120)]),
      ],
      [...h, history([trade("TRANSFER", 10, 0, 2)], "third")],
    )[0].totalProfit,
  ).toBeNull();
  const sameDay = [
    history([trade("BUY", 10, -100, 2), trade("TRANSFER", 10, 0, 2)], "source"),
    h[1],
  ];
  expect(
    calculateHoldingReturns(
      [account("source"), account("destination", [position(10, 120)])],
      sameDay,
    )[0].totalProfit,
  ).toBeNull();
});
it("does not invent basis for incoming external transfers or move cost between different institutions", () => {
  const rows = calculateHoldingReturns(
    [account("destination", [position(10, 120)])],
    [history([trade("TRANSFER", 10, 0, 2)], "destination")],
  );
  expect(rows[0].totalProfit).toBeNull();
  const different = account("destination", [position(10, 120)]);
  different.account.institution = "Different";
  expect(
    calculateHoldingReturns(
      [account("source"), different],
      [
        history(
          [trade("BUY", 10, -100, 1), trade("TRANSFER", 10, 0, 2)],
          "source",
        ),
        history([trade("TRANSFER", 10, 0, 2)], "destination"),
      ],
    )[0].totalProfit,
  ).toBeNull();
});
