import { expect, it } from "vitest";
import {
  assumeOptionsUsd,
  isAssumedOptionsCurrency,
} from "@/lib/options/currency";
import { normalizeTransaction } from "@/server/normalize-transactions";
import { buildOptionsLedger } from "@/lib/options/ledger";
function option(code?: string) {
  return normalizeTransaction(
    {
      id: "synthetic-option",
      type: "BUY",
      option_type: "BUY_TO_OPEN",
      units: 1,
      amount: -100,
      price: 1,
      fee: 0,
      trade_date: "2026-10-01",
      currency: code ? { code } : null,
      option_symbol: {
        id: "synthetic-contract",
        ticker: "SYNTH261218C00100000",
        option_type: "CALL",
        strike_price: 100,
        expiration_date: "2026-12-18",
        underlying_symbol: { symbol: "SYNTH" },
      },
    },
    "synthetic-account",
  );
}
it.each(["USD", "CAD", "EUR", undefined])(
  "assumes USD for option money without converting %s amounts or changing raw facts",
  (code) => {
    const raw = option(code),
      result = assumeOptionsUsd(raw);
    for (const field of [
      "cashFlow",
      "fee",
      "price",
      "grossAmount",
      "netAmount",
    ] as const) {
      expect(result[field].currency.value).toBe("USD");
      expect(result[field].amount).toEqual(raw[field].amount);
    }
    expect(result.sourceValues.currency).toBe(code || null);
    expect(raw.cashFlow.currency.value).toBe(code || null);
    expect(assumeOptionsUsd(result).sourceValues.currency).toBe(code || null);
    if (code !== "USD")
      expect(isAssumedOptionsCurrency(result.cashFlow.currency)).toBe(true);
  },
);
it("uses the explicit USD assumption for a missing currency while keeping missing fees unresolved", () => {
  const open = option();
  const close = {
    ...option("CAD"),
    id: "close",
    type: "SELL",
    optionAction: "SELL_TO_CLOSE" as const,
    tradeDate: { ...open.tradeDate, day: "2026-10-02", raw: "2026-10-02" },
    cashFlow: {
      ...open.cashFlow,
      amount: {
        ...open.cashFlow.amount,
        status: "confirmed" as const,
        value: open.price.amount.value!,
      },
    },
  };
  const result = buildOptionsLedger(
    [{ accountId: "synthetic-account", records: [open, close], issues: [] }],
    "2026-10-31",
  );
  expect(result.trades[0]).toMatchObject({
    currency: "USD",
    status: "closed",
    realizedPnl: "-99",
  });
  const missing = {
    ...open,
    fee: {
      ...open.fee,
      amount: {
        ...open.fee.amount,
        status: "missing" as const,
        value: null,
        reason: "Not supplied",
      },
    },
  };
  expect(
    buildOptionsLedger(
      [
        {
          accountId: "synthetic-account",
          records: [missing, close],
          issues: [],
        },
      ],
      "2026-10-31",
    ).trades[0].realizedPnl,
  ).toBeNull();
});
it("preserves stock currencies and source identity matching inputs", () => {
  const stock = normalizeTransaction(
    {
      id: "synthetic-stock",
      type: "BUY",
      symbol: { symbol: "SYNTH" },
      currency: { code: "CAD" },
      amount: -100,
    },
    "synthetic-account",
  );
  expect(assumeOptionsUsd(stock)).toBe(stock);
  expect(stock.cashFlow.currency.value).toBe("CAD");
});
