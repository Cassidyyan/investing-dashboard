import { expect, it } from "vitest";
import { historyQuality, transactionSync } from "@/server/history-quality";
import { normalizeAccount } from "@/server/normalize";
import { normalizeTransaction } from "@/server/normalize-transactions";
it("tracks transaction sync independently from stale holdings and treats missing metadata as unknown", () => {
  const account = normalizeAccount({
    id: "a",
    sync_status: {
      holdings: { last_successful_sync: "2000-01-01" },
      transactions: {
        initial_sync_completed: true,
        first_transaction_date: "2018-01-01",
        last_successful_sync: "2026-10-30",
      },
    },
  } as Parameters<typeof normalizeAccount>[0]);
  expect(account.stale).toBe(true);
  expect(account.transactionSync).toMatchObject({
    initialSyncCompleted: true,
    firstTransactionDate: "2018-01-01",
  });
  expect(transactionSync(undefined).initialSyncCompleted).toBeNull();
  expect(
    transactionSync({ first_transaction_date: "invalid" }).invalidMetadata,
  ).toBe(true);
});
it("counts field gaps only in applicable records and never treats reported zero as missing", () => {
  const result = historyQuality([
    {
      id: "cash",
      type: "CONTRIBUTION",
      amount: 0,
      trade_date: "2020-01-01",
      currency: { code: "CAD" },
    },
    {
      id: "option",
      type: "BUY",
      units: 0,
      price: 0,
      amount: 0,
      fee: 0,
      trade_date: "2026-10-01",
      currency: { code: "USD" },
      option_symbol: {
        id: "contract",
        option_type: "CALL",
        underlying_symbol: {},
        ticker: "SYNTH261218C00100000",
        strike_price: 100,
        expiration_date: "2026-12-18",
      },
    },
  ]);
  expect(result).toMatchObject({
    earliest: "2020-01-01",
    latest: "2026-10-01",
    optionRecords: 1,
  });
  expect(result.fields.find((f) => f.field === "Trade fee")).toMatchObject({
    applicable: 1,
    missing: 0,
    invalid: 0,
  });
  expect(
    result.fields.find((f) => f.field === "Option direction"),
  ).toMatchObject({ applicable: 1, missing: 1 });
});
it("preserves source identifiers and raw symbols without guessing their exchange-qualified ticker", () => {
  const t = normalizeTransaction(
    {
      id: "one",
      symbol: { id: "id", raw_symbol: "SYNTH" },
      option_symbol: {
        id: "option",
        ticker: "SYNTH261218C00100000",
        option_type: "CALL",
        strike_price: 100,
        expiration_date: "2026-12-18",
        is_mini_option: false,
        underlying_symbol: { raw_symbol: "SYNTH" },
      },
    },
    "a",
  );
  expect(t.ticker).toBeNull();
  expect(t.sourceMetadata).toMatchObject({
    rawSecuritySymbol: "SYNTH",
    optionContractId: "option",
    rawUnderlyingSymbol: "SYNTH",
    isMiniOption: false,
  });
  expect(t.option?.multiplier.value).toBeNull();
});

it("counts observed broker-native expiry and assignment aliases in coverage", () => {
  const result = historyQuality([
    { type: "OPTIONS_SHORT_EXPIRY" },
    { type: "OPTIONS_ASSIGN" },
    { type: "OPTIONEXPIRATION" },
  ]);
  expect(result.events).toEqual({ assignment: 1, exercise: 0, expiration: 2 });
});
