import { expect, it } from "vitest";
import {
  normalizeTransaction,
  normalizeOrderRecord,
} from "@/server/normalize-transactions";
it("retains transaction identity, settlement currency, source amounts and fee uncertainty", () => {
  const row = normalizeTransaction(
    {
      id: "synthetic",
      type: "BUY",
      trade_date: "2026-10-30T14:00:00Z",
      settlement_date: "2026-11-02",
      currency: { code: "CAD" },
      symbol: { id: "security", symbol: "SYNTH", currency: { code: "USD" } },
      units: 1.5,
      price: 20,
      amount: -30,
      fee: 0,
      fx_rate: 1.3,
      external_reference_id: "group",
    },
    "account",
  );
  expect(row.accountId).toBe("account");
  expect(row.cashFlow.currency.value).toBe("CAD");
  expect(row.securityCurrency).toBe("USD");
  expect(row.cashFlow.amount.value).toBe("-30");
  expect(row.fee.amount.value).toBe("0");
  expect(row.settlementDate.day).toBe("2026-11-02");
  expect(row.grossAmount.amount.status).toBe("unsupported");
  expect(row.netAmount.amount.value).toBeNull();
  expect(row.sourceValues).toEqual({
    units: 1.5,
    price: 20,
    amount: -30,
    fee: 0,
    fxRate: 1.3,
  });
});
it("keeps missing amount/fees missing and never imports a current delta as entry delta", () => {
  const row = normalizeTransaction(
    { id: "synthetic", type: "SELL", greeks: { delta: 0.2 } },
    "account",
  );
  expect(row.cashFlow.amount.status).toBe("missing");
  expect(row.fee.amount.status).toBe("missing");
  expect(row.entryDelta.status).toBe("unavailable");
});
it("flags cross-account and inconsistent option action records", () => {
  const row = normalizeTransaction(
    {
      id: "synthetic",
      account: { id: "other" },
      type: "BUY",
      option_type: "SELL_TO_OPEN",
    },
    "account",
  );
  expect(row.issues.map((i) => i.code)).toEqual([
    "account_scope_mismatch",
    "option_action_conflict",
  ]);
});
it("models order fills as cumulative snapshots rather than individual executions", () => {
  const row = normalizeOrderRecord(
    {
      brokerage_order_id: "order",
      brokerage_group_order_id: "group",
      total_quantity: "3",
      filled_quantity: "2",
      open_quantity: "1",
      execution_price: "1.25",
      time_placed: "2026-10-30T10:00:00Z",
    },
    "account",
  );
  expect(row.recordKind).toBe("order-snapshot");
  expect(row.filledQuantity.value).toBe("2");
  expect(row.executionIdentity.status).toBe("missing");
  expect(row.executionPrice.currency.value).toBeNull();
});
