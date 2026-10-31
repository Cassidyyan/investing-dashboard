import { expect, it } from "vitest";
import type { UniversalActivity } from "snaptrade-typescript-sdk";
import { normalizeTransaction } from "@/server/normalize-transactions";
import { reconcileOptionExecutions } from "@/lib/options/reconcile-executions";
import { decimal } from "@/lib/financial/decimal";
const asOf = "2026-10-31";
function activity(
  id: string,
  action: string,
  quantity: number,
  date = "2026-10-01T14:00:00Z",
  account = "a",
) {
  return normalizeTransaction(
    {
      id,
      type: action.startsWith("BUY") ? "BUY" : "SELL",
      option_type: action,
      units: quantity,
      trade_date: date,
      currency: { code: "USD" },
      amount: action.startsWith("SELL") ? 100 : -50,
      fee: 1,
      option_symbol: {
        id: "contract",
        ticker: "SYNTH261218P00150000",
        option_type: "PUT",
        strike_price: 150,
        expiration_date: "2026-12-18",
        underlying_symbol: { id: "underlying", symbol: "SYNTH" },
      },
    } as UniversalActivity,
    account,
  );
}
it.each([
  ["SELL_TO_OPEN", "BUY_TO_CLOSE", "short"],
  ["BUY_TO_OPEN", "SELL_TO_CLOSE", "long"],
])(
  "matches explicit %s/%s without interpreting premiums as profit",
  (open, close, direction) => {
    const result = reconcileOptionExecutions(
      [
        activity("open", open, 3),
        activity("close", close, 1, "2026-10-02T14:00:00Z"),
      ],
      asOf,
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ direction, quantity: "1" });
    expect(result.openLots[0].remainingQuantity).toBe("2");
    expect(result.accountingStatus).toBe("not-calculated");
    expect(result.executions[0].entryDelta.status).toBe("unavailable");
  },
);
it("handles multiple partial fills and partial closes chronologically", () => {
  const rows = [
    activity("fill1", "SELL_TO_OPEN", 1),
    activity("fill2", "SELL_TO_OPEN", 2, "2026-10-01T14:01:00Z"),
    activity("close1", "BUY_TO_CLOSE", 1.5, "2026-10-02T14:00:00Z"),
    activity("close2", "BUY_TO_CLOSE", 1.5, "2026-10-03T14:00:00Z"),
  ];
  const result = reconcileOptionExecutions(rows.reverse(), asOf);
  expect(result.matches.map((m) => m.quantity)).toEqual(["1", "0.5", "1.5"]);
  expect(result.openLots).toEqual([]);
  expect(result.issues).toEqual([]);
});
it("ignores exact repeats but keeps separate fills sharing an external order reference", () => {
  const first = activity("one", "SELL_TO_OPEN", 1),
    second = activity("two", "SELL_TO_OPEN", 1, "2026-10-01T14:01:00Z");
  first.externalReferenceId = "same-order";
  second.externalReferenceId = "same-order";
  const r = reconcileOptionExecutions([first, first, second], asOf);
  expect(r.executions).toHaveLength(2);
  expect(r.openLots).toHaveLength(2);
  expect(r.issues[0].code).toBe("identical_duplicate_ignored");
});
it("does not match conflicting IDs, missing actions, or same-day uncertain sequencing", () => {
  const first = activity("one", "SELL_TO_OPEN", 1),
    changed = activity("one", "SELL_TO_OPEN", 2);
  expect(
    reconcileOptionExecutions([first, changed], asOf).executions,
  ).toHaveLength(0);
  const noAction = activity("unknown", "SELL_TO_OPEN", 1);
  noAction.optionAction = "unknown";
  expect(reconcileOptionExecutions([noAction], asOf).issues[0].code).toBe(
    "ambiguous_open_close_action",
  );
  const r = reconcileOptionExecutions(
    [
      activity("open", "SELL_TO_OPEN", 1, "2026-10-01"),
      activity("close", "BUY_TO_CLOSE", 1, "2026-10-01"),
    ],
    asOf,
  );
  expect(r.matches).toEqual([]);
  expect(r.issues.some((i) => i.code === "ambiguous_execution_order")).toBe(
    true,
  );
});
it("keeps accounts separate even with identical transaction IDs and contracts", () => {
  const r = reconcileOptionExecutions(
    [
      activity("same", "SELL_TO_OPEN", 1, undefined, "a"),
      activity("same", "BUY_TO_CLOSE", 1, "2026-10-02T14:00:00Z", "b"),
    ],
    asOf,
  );
  expect(r.matches).toEqual([]);
  expect(
    r.issues.some((i) => i.code === "close_exceeds_known_open_quantity"),
  ).toBe(true);
});
it("orders precise executions by instant across different timezone offsets", () => {
  const open = activity("open", "BUY_TO_OPEN", 1, "2026-10-02T00:30:00+09:00");
  const close = activity(
    "close",
    "SELL_TO_CLOSE",
    1,
    "2026-10-01T23:00:00-04:00",
  );
  const r = reconcileOptionExecutions([close, open], asOf);
  expect(r.matches).toHaveLength(1);
  expect(r.issues).toEqual([]);
});
it.each(["OPTIONEXPIRATION", "OPTIONASSIGNMENT", "OPTIONEXERCISE"])(
  "preserves %s events without fabricating a zero-cost closing execution",
  (type) => {
    const open = activity("open", "SELL_TO_OPEN", 1);
    const event = activity("event", "BUY_TO_CLOSE", 1, "2026-10-02");
    event.type = type;
    const r = reconcileOptionExecutions([open, event], asOf);
    expect(r.events).toHaveLength(1);
    expect(r.matches).toEqual([]);
    expect(r.openLots[0].remainingQuantity).toBe("1");
  },
);
it("does not mark expired contracts as profitable or infer a roll or strategy", () => {
  const open = activity("open", "SELL_TO_OPEN", 1);
  const r = reconcileOptionExecutions([open], "2027-01-01");
  expect(r.matches).toEqual([]);
  expect(
    r.issues.some(
      (i) => i.code === "expired_contract_without_reconciled_outcome",
    ),
  ).toBe(true);
  expect(r).not.toHaveProperty("realizedPnl");
});
it("does not mix underlying prices, quote currencies or missing Greeks into matching", () => {
  const open = activity("open", "BUY_TO_OPEN", 1);
  open.cashFlow.currency = {
    ...open.cashFlow.currency,
    status: "missing",
    value: null,
    reason: "Unknown",
  };
  const close = activity("close", "SELL_TO_CLOSE", 1, "2026-10-02T14:00:00Z");
  const r = reconcileOptionExecutions([open, close], asOf);
  expect(r.matches).toHaveLength(1);
  expect(r.accountingStatus).toBe("not-calculated");
});
it("keeps roll legs separate instead of inferring a strategy", () => {
  const close = activity("close", "BUY_TO_CLOSE", 1, "2026-10-02T14:00:00Z");
  const newLeg = activity("new", "SELL_TO_OPEN", 1, "2026-10-02T14:01:00Z");
  newLeg.option = {
    ...newLeg.option!,
    symbol: "SYNTH261218P00160000",
    strike: {
      ...newLeg.option!.strike,
      amount: {
        status: "confirmed",
        provenance: newLeg.option!.strike.amount.provenance,
        value: decimal("160")!,
      },
    },
  };
  close.externalReferenceId = newLeg.externalReferenceId = "roll-order";
  const r = reconcileOptionExecutions(
    [activity("open", "SELL_TO_OPEN", 1), close, newLeg],
    asOf,
  );
  expect(r.matches).toHaveLength(1);
  expect(r.openLots).toHaveLength(1);
  expect(r).not.toHaveProperty("strategy");
});
it("rejects missing identities/contracts, zero quantities and future executions", () => {
  const noId = activity("one", "SELL_TO_OPEN", 1);
  noId.id = null;
  const noContract = activity("two", "SELL_TO_OPEN", 1);
  noContract.option = null;
  const r = reconcileOptionExecutions(
    [
      noId,
      noContract,
      activity("zero", "BUY_TO_OPEN", 0),
      activity("future", "BUY_TO_OPEN", 1, "2026-11-01"),
    ],
    asOf,
  );
  expect(r.executions).toEqual([]);
  expect(r.issues.map((i) => i.code)).toEqual([
    "missing_execution_identity",
    "incomplete_option_contract",
    "missing_or_zero_contract_quantity",
    "execution_after_as_of",
  ]);
  expect(r.reconciliationStatus).toBe("needs-review");
});
it("blocks matching when explicit multipliers for the same contract conflict", () => {
  const open = activity("open", "BUY_TO_OPEN", 1);
  const close = activity("close", "SELL_TO_CLOSE", 1, "2026-10-02T14:00:00Z");
  open.option!.multiplier = {
    status: "confirmed",
    value: decimal("100")!,
    provenance: { provider: "snaptrade", field: "multiplier" },
  };
  close.option!.multiplier = {
    ...open.option!.multiplier,
    value: decimal("10")!,
  };
  const r = reconcileOptionExecutions([open, close], asOf);
  expect(r.matches).toEqual([]);
  expect(
    r.issues.every((i) => i.code === "conflicting_contract_multiplier"),
  ).toBe(true);
});
