import { expect, it } from "vitest";
import type { UniversalActivity } from "snaptrade-typescript-sdk";
import { normalizeTransaction } from "@/server/normalize-transactions";
import { buildOptionsLedger } from "@/lib/options/ledger";
import { optionsAnalytics } from "@/lib/options/analytics";
import { decimal, divideDecimal } from "@/lib/financial/decimal";
import type { OptionsFilters } from "@/lib/options/analytics-types";
function tx(
  id: string,
  action: string,
  units: number,
  amount: number,
  date = "2026-09-01T14:00:00Z",
  extra: Partial<UniversalActivity> = {},
) {
  return normalizeTransaction(
    {
      id,
      type: action.startsWith("BUY") ? "BUY" : "SELL",
      option_type: action,
      units,
      amount,
      price: Math.abs(amount) / units / 100,
      fee: 0,
      trade_date: date,
      currency: { code: "USD" },
      option_symbol: {
        ticker: "SYNTH261016P00100000",
        option_type: "PUT",
        strike_price: 100,
        expiration_date: "2026-10-16",
        underlying_symbol: { symbol: "SYNTH" },
      },
      ...extra,
    } as UniversalActivity,
    "a",
  );
}
const filters: OptionsFilters = {
  account: "all",
  ticker: "all",
  currency: "USD",
  from: "",
  to: "",
  right: "all",
  status: "all",
};
const ledger = (records: ReturnType<typeof tx>[], issues: string[] = []) =>
  buildOptionsLedger([{ accountId: "a", records, issues }], "2026-10-31");
it.each([
  ["SELL_TO_OPEN", "BUY_TO_CLOSE", 200, -80, "120", "win"],
  ["SELL_TO_OPEN", "BUY_TO_CLOSE", 100, -160, "-60", "loss"],
  ["BUY_TO_OPEN", "SELL_TO_CLOSE", -100, 180, "80", "win"],
  ["BUY_TO_OPEN", "SELL_TO_CLOSE", -100, 100, "0", "breakeven"],
])(
  "reconciles %s/%s without equating premium receipts with profit",
  (open, close, credit, debit, pnl, outcome) => {
    const data = ledger([
      tx("o", open, 1, credit),
      tx("c", close, 1, debit, "2026-09-02T14:00:00Z"),
    ]);
    expect(data.trades[0]).toMatchObject({
      status: "closed",
      realizedPnl: pnl,
      outcome,
    });
    const stats = optionsAnalytics(data, filters);
    expect(stats.pnl).toBe(pnl);
    expect(stats.completed).toHaveLength(1);
  },
);
it("recognizes only matched partial quantities and assigns gains to the actual closing dates", () => {
  const records = [
    tx("o", "SELL_TO_OPEN", 3, 300),
    tx("c", "BUY_TO_CLOSE", 1, -40, "2026-09-02T14:00:00Z"),
  ];
  // Future expiry avoids treating the remaining lot as an unresolved past expiry.
  for (const r of records) {
    r.option!.expiration = {
      ...r.option!.expiration,
      status: "confirmed",
      value: "2026-12-18",
    };
    r.option!.symbol = "SYNTH261218P00100000";
  }
  const data = ledger(records),
    stats = optionsAnalytics(data, filters);
  expect(data.trades[0]).toMatchObject({
    status: "partial",
    remainingQuantity: "2",
    realizedPnl: "60",
  });
  expect(stats.completed).toHaveLength(0);
  expect(stats.pnl).toBe("60");
  expect(stats.series[0].date).toBe("2026-09-02");
});
it("groups multiple fills in a continuous lifecycle, then separates repeated same-contract trades", () => {
  const data = ledger([
    tx("o1", "BUY_TO_OPEN", 1, -100),
    tx("o2", "BUY_TO_OPEN", 2, -220, "2026-09-01T14:01:00Z"),
    tx("c1", "SELL_TO_CLOSE", 3, 450, "2026-09-02T14:00:00Z"),
    tx("o3", "BUY_TO_OPEN", 1, -100, "2026-09-03T14:00:00Z"),
    tx("c2", "SELL_TO_CLOSE", 1, 90, "2026-09-04T14:00:00Z"),
  ]);
  expect(data.trades.map((t) => t.realizedPnl)).toEqual(["130", "-10"]);
  expect(data.trades[0].executions).toHaveLength(3);
  expect(optionsAnalytics(data, filters).winRate).toBe(50);
});
it("uses explicit zero-settlement expiration evidence without inventing assignment/exercise profit", () => {
  const open = tx("o", "SELL_TO_OPEN", 1, 100);
  const event = tx("expiry", "BUY_TO_CLOSE", 1, 0, "2026-10-16", {
    type: "OPTIONEXPIRATION",
    option_type: undefined,
  });
  const data = ledger([open, event]);
  expect(data.trades[0]).toMatchObject({
    status: "closed",
    realizedPnl: "100",
  });
  for (const type of ["OPTIONASSIGNMENT", "OPTIONEXERCISE"]) {
    const result = ledger([open, { ...event, id: type, type }]);
    expect(optionsAnalytics(result, filters).pnl).toBeNull();
    expect(result.trades.every((t) => t.outcome === "unclassified")).toBe(true);
  }
});
it("keeps unrelated roll contracts separate and deduplicates repeated activities", () => {
  const o = tx("o", "SELL_TO_OPEN", 1, 100),
    c = tx("c", "BUY_TO_CLOSE", 1, -50, "2026-09-02T14:00:00Z");
  const next = tx("new", "SELL_TO_OPEN", 1, 120, "2026-09-02T14:01:00Z");
  next.option!.symbol = "SYNTH261218P00100000";
  next.option!.expiration = {
    ...next.option!.expiration,
    status: "confirmed",
    value: "2026-12-18",
  };
  const data = ledger([o, o, c, next]);
  expect(data.trades).toHaveLength(2);
  expect(optionsAnalytics(data, filters).pnl).toBe("50");
  expect(optionsAnalytics(data, filters).openingCredits).toBe("220");
});
it("leaves missing fees, unmatched closes and incomplete history unclassified", () => {
  const open = tx("o", "BUY_TO_OPEN", 1, -100),
    close = tx("c", "SELL_TO_CLOSE", 1, 150, "2026-09-02T14:00:00Z");
  const missing = tx("missing", "BUY_TO_OPEN", 1, -100, undefined, {
    fee: undefined,
  });
  for (const data of [
    ledger([missing, close]),
    ledger([close]),
    ledger([open, close], ["History incomplete"]),
  ]) {
    expect(optionsAnalytics(data, filters).pnl).toBeNull();
    expect(data.trades.every((t) => t.status === "needs-review")).toBe(true);
  }
});
it("does not assume a multiplier for nonzero fees, but can sum confirmed zero-fee cash independently of it", () => {
  const o = tx("o", "SELL_TO_OPEN", 1, 200, undefined, { fee: 1 }),
    c = tx("c", "BUY_TO_CLOSE", 1, -80, "2026-09-02T14:00:00Z", { fee: 1 });
  expect(optionsAnalytics(ledger([o, c]), filters).pnl).toBeNull();
  for (const r of [o, c])
    r.option!.multiplier = {
      status: "confirmed",
      value: decimal("100")!,
      provenance: {
        provider: "snaptrade",
        field: "synthetic.explicit_multiplier",
      },
    };
  // Gross amounts match price × quantity × explicit multiplier; deduct each fee once.
  expect(optionsAnalytics(ledger([o, c]), filters).pnl).toBe("118");
  const z = tx("z", "SELL_TO_OPEN", 1, 200),
    zc = tx("zc", "BUY_TO_CLOSE", 1, -80, "2026-09-02T14:00:00Z");
  expect(z.option!.multiplier.value).toBeNull();
  expect(optionsAnalytics(ledger([z, zc]), filters).pnl).toBe("120");
});
it("validates net-fee amounts instead of deducting reported fees twice", () => {
  const o = tx("o", "SELL_TO_OPEN", 1, 199, undefined, { price: 2, fee: 1 }),
    c = tx("c", "BUY_TO_CLOSE", 1, -81, "2026-09-02T14:00:00Z", {
      price: 0.8,
      fee: 1,
    });
  for (const r of [o, c])
    r.option!.multiplier = {
      status: "confirmed",
      value: decimal("100")!,
      provenance: {
        provider: "snaptrade",
        field: "synthetic.explicit_multiplier",
      },
    };
  const data = ledger([o, c]);
  expect(data.trades[0].fees).toBe("2");
  expect(data.trades[0].realizedPnl).toBe("118");
});
it("does not turn malformed contracts or invalid multipliers into profitable trades", () => {
  for (const invalid of ["0", "-100", "bad"]) {
    const o = tx("o", "BUY_TO_OPEN", 1, -100),
      c = tx("c", "SELL_TO_CLOSE", 1, 200, "2026-09-02T14:00:00Z");
    o.option!.multiplier = {
      status: "unsupported",
      value: null,
      reason: invalid,
      provenance: { provider: "snaptrade", field: "multiplier" },
    };
    expect(optionsAnalytics(ledger([o, c]), filters).pnl).toBeNull();
  }
  const unknown = tx("u", "SELL_TO_OPEN", 1, 100);
  unknown.option!.symbol = null;
  expect(ledger([unknown]).trades[0].status).toBe("needs-review");
});
it("uses realization dates for P&L and transaction dates for premiums, with native currency isolation", () => {
  const data = ledger([
    tx("o", "SELL_TO_OPEN", 1, 200),
    tx("c", "BUY_TO_CLOSE", 1, -80, "2026-10-02T14:00:00Z"),
  ]);
  const stats = optionsAnalytics(data, { ...filters, from: "2026-10-01" });
  expect(stats.pnl).toBe("120");
  expect(stats.premiumReceived).toBe("0");
  expect(stats.premiumPaid).toBe("80");
  expect(
    optionsAnalytics(data, { ...filters, currency: "CAD" }).pnl,
  ).toBeNull();
  expect(optionsAnalytics(data, filters).profitFactor.status).toBe("infinite");
});
it("rounds fractional allocations explicitly and preserves the source total on final close", () => {
  expect(divideDecimal(decimal("1")!, decimal("3")!)).toBe("0.333333333333");
  const data = ledger([
    tx("o", "SELL_TO_OPEN", 3, 100),
    tx("c1", "BUY_TO_CLOSE", 1, -10, "2026-09-02T14:00:00Z"),
    tx("c2", "BUY_TO_CLOSE", 2, -20, "2026-09-03T14:00:00Z"),
  ]);
  expect(data.trades[0].realizedPnl).toBe("70");
  expect(optionsAnalytics(data, filters).pnl).toBe("70");
});

it("rejects unallocated fees and linked cash adjustments without double counting", () => {
  const open = tx("o", "SELL_TO_OPEN", 1, 200),
    close = tx("c", "BUY_TO_CLOSE", 1, -100, "2026-09-02T14:00:00Z");
  const fee = normalizeTransaction(
    {
      id: "fee",
      type: "FEE",
      amount: -2,
      fee: 0,
      trade_date: "2026-09-02",
      currency: { code: "USD" },
    },
    "a",
  );
  expect(optionsAnalytics(ledger([open, close, fee]), filters).pnl).toBeNull();
  open.externalReferenceId = fee.externalReferenceId = "related";
  expect(optionsAnalytics(ledger([open, close, fee]), filters).pnl).toBeNull();
});
it("does not invent zero-settlement expiration from a missing amount, quantity or fee", () => {
  for (const extra of [
    { amount: undefined },
    { units: undefined },
    { fee: undefined },
  ]) {
    const event = tx("expiry", "BUY_TO_CLOSE", 1, 0, "2026-10-16", {
      type: "OPTIONEXPIRATION",
      option_type: undefined,
      ...extra,
    });
    expect(
      optionsAnalytics(
        ledger([tx("o", "SELL_TO_OPEN", 1, 100), event]),
        filters,
      ).pnl,
    ).toBeNull();
  }
});
it("does not create a false opening date for unresolved assignment events", () => {
  const event = tx("event", "BUY_TO_CLOSE", 1, 0, "2026-10-16", {
    type: "OPTIONASSIGNMENT",
    option_type: undefined,
  });
  const row = ledger([event]).trades[0];
  expect(row.openedOn).toBeNull();
  expect(row.observedOn).toBe("2026-10-16");
  expect(optionsAnalytics(ledger([event]), filters).journal).toHaveLength(1);
  expect(row.events[0].type).toBe("OPTIONASSIGNMENT");
});
it("retains cash-based results when price is missing, leaving entry premium unavailable", () => {
  const data = ledger([
    tx("o", "BUY_TO_OPEN", 1, -100, undefined, { price: undefined }),
    tx("c", "SELL_TO_CLOSE", 1, 150, "2026-09-02T14:00:00Z"),
  ]);
  expect(data.trades[0].entryPremium).toBeNull();
  expect(data.trades[0].realizedPnl).toBe("50");
});
it("keeps monthly totals exact and excludes uncertain timing from finalized trades", () => {
  const data = ledger([
    tx("o", "BUY_TO_OPEN", 1, -0.1),
    tx("c", "SELL_TO_CLOSE", 1, 0.3, "2026-09-02T14:00:00Z"),
  ]);
  expect(optionsAnalytics(data, filters).monthlySeries[0].cumulative).toBe(
    "0.2",
  );
  const ambiguous = ledger([
    tx("o", "BUY_TO_OPEN", 1, -100, "2026-09-01"),
    tx("c", "SELL_TO_CLOSE", 1, 200, "2026-09-01"),
  ]);
  expect(optionsAnalytics(ambiguous, filters).completed).toEqual([]);
  expect(optionsAnalytics(ambiguous, filters).pnl).toBeNull();
});

it("separates breakeven and finite profit factor from winning/losing averages", () => {
  const data = ledger([
    tx("o1", "SELL_TO_OPEN", 1, 200),
    tx("c1", "BUY_TO_CLOSE", 1, -80, "2026-09-02T14:00:00Z"),
    tx("o2", "BUY_TO_OPEN", 1, -100, "2026-09-03T14:00:00Z"),
    tx("c2", "SELL_TO_CLOSE", 1, 40, "2026-09-04T14:00:00Z"),
    tx("o3", "BUY_TO_OPEN", 1, -100, "2026-09-05T14:00:00Z"),
    tx("c3", "SELL_TO_CLOSE", 1, 100, "2026-09-06T14:00:00Z"),
  ]);
  const stats = optionsAnalytics(data, filters);
  expect(stats.pnl).toBe("60");
  expect(stats.completed).toHaveLength(3);
  expect(stats.breakeven).toBe(1);
  expect(stats.winRate).toBeCloseTo(100 / 3);
  expect(stats.profitFactor).toEqual({ status: "finite", value: "2" });
  expect(stats.averageWin).toBe("120");
  expect(stats.averageLoss).toBe("-60");
});
it("does not promote estimated financial fields into confirmed realized P&L", () => {
  const o = tx("o", "SELL_TO_OPEN", 1, 200),
    c = tx("c", "BUY_TO_CLOSE", 1, -80, "2026-09-02T14:00:00Z");
  o.cashFlow.amount = {
    status: "estimated",
    value: decimal("200")!,
    provenance: { provider: "application", field: "estimated_amount" },
  };
  expect(optionsAnalytics(ledger([o, c]), filters).pnl).toBeNull();
});
it("uses explicit division rounding for fees and rejects undefined arithmetic", () => {
  expect(divideDecimal(decimal("-1")!, decimal("2")!, 0)).toBe("-1");
  expect(divideDecimal(decimal("1")!, decimal("8")!, 2)).toBe("0.13");
  expect(() => divideDecimal(decimal("1")!, decimal("0")!)).toThrow();
  expect(() => divideDecimal(decimal("1")!, decimal("2")!, 99)).toThrow();
});

it("deduplicates expiration evidence before tracking exposure", () => {
  const open = tx("o", "SELL_TO_OPEN", 1, 100),
    event = tx("expiry", "BUY_TO_CLOSE", 1, 0, "2026-10-16", {
      type: "OPTIONEXPIRATION",
      option_type: undefined,
    });
  const data = ledger([open, open, event, event]);
  expect(data.trades).toHaveLength(1);
  expect(data.trades[0].realizedPnl).toBe("100");
});

it("keeps a completed lifecycle inspectable in an opening-period premium range", () => {
  const data = ledger([
    tx("o", "SELL_TO_OPEN", 1, 200),
    tx("c", "BUY_TO_CLOSE", 1, -80, "2026-10-02T14:00:00Z"),
  ]);
  const stats = optionsAnalytics(data, {
    ...filters,
    from: "2026-09-01",
    to: "2026-09-01",
  });
  expect(stats.journal).toHaveLength(1);
  expect(stats.pnl).toBeNull();
  expect(stats.premiumReceived).toBe("200");
});
