import { expect, it } from "vitest";
import { parseWealthsimpleActivity } from "@/lib/imports/wealthsimple-activity";
import { csvOptionHistory } from "@/lib/imports/csv-option-history";
import { normalizeTransaction } from "@/server/normalize-transactions";
import { buildOptionsLedger } from "@/lib/options/ledger";
import type { OptionsHistory } from "@/lib/options/analytics-types";
const header =
  "effective_date,effective_time,account_id,activity_type,activity_sub_type,symbol,currency,quantity,unit_price,commission,net_cash_amount,direction";
const symbol = "SYNTH261016C00100000";
const open = `2026-09-01,10:00:00,CSV_SYNTHETIC,Trade,SELL,${symbol},USD,-1,1,2,98,SHORT`;
const close = `2026-09-02,10:00:00,CSV_SYNTHETIC,Trade,BUY,${symbol},USD,1,0.4,1,-41,SHORT`;
const expiry = `2026-10-16,12:00:00,CSV_SYNTHETIC,OptionExpiry,Short-call,${symbol},USD,1,,,,SHORT`;
const parse = (rows: string[]) =>
  parseWealthsimpleActivity([header, ...rows].join("\n")).activities;
const mappings = new Map([["CSV_SYNTHETIC", new Set(["sdk"])]]);
const sdkExpiry = () =>
  normalizeTransaction(
    {
      id: "expiry",
      type: "OPTIONS_SHORT_EXPIRY",
      units: 1,
      amount: 0,
      fee: 0,
      price: 0,
      trade_date: "2026-10-16",
      currency: { code: "USD" },
      option_symbol: {
        id: "synthetic-option",
        ticker: symbol,
        option_type: "CALL",
        strike_price: 100,
        expiration_date: "2026-10-16",
        underlying_symbol: { symbol: "SYNTH" },
      },
    },
    "sdk",
  );
const input = (records: OptionsHistory["records"] = []): OptionsHistory[] => [
  { accountId: "sdk", records, issues: [] },
];
const calculate = (rows: string[], records: OptionsHistory["records"] = []) => {
  const result = csvOptionHistory(input(records), parse(rows), mappings);
  return { result, ledger: buildOptionsLedger(result.histories, "2026-10-31") };
};
it("calculates native trade profit from reported net cash once without an assumed multiplier", () => {
  const { ledger } = calculate([open, close]);
  expect(ledger.trades[0]).toMatchObject({
    status: "closed",
    realizedPnl: "57",
    fees: "3",
  });
  expect(ledger.trades[0].contract?.multiplier.value).toBeNull();
  expect(ledger.trades[0].entryDte).toBe(45);
});
it("uses a CSV-covered-period cohort rather than counting duplicate API observations", () => {
  const api = normalizeTransaction(
    {
      id: "duplicate-observation",
      type: "SELL",
      units: -1,
      amount: 100,
      fee: 2,
      trade_date: "2026-09-01",
      currency: { code: "USD" },
      option_symbol: {
        id: "synthetic-option",
        ticker: symbol,
        option_type: "CALL",
        strike_price: 100,
        expiration_date: "2026-10-16",
        underlying_symbol: { symbol: "SYNTH" },
      },
    },
    "sdk",
  );
  const { result, ledger } = calculate([open, close], [api]);
  expect(result.counts.overlappingApiOptions).toBe(1);
  expect(ledger.trades).toHaveLength(1);
  expect(ledger.trades[0].realizedPnl).toBe("57");
});
it("uses explicit zero API expiry settlement while retaining its source provenance", () => {
  const { result, ledger } = calculate([open, expiry], [sdkExpiry()]);
  expect(ledger.trades[0]).toMatchObject({
    status: "closed",
    realizedPnl: "98",
  });
  const event = result.histories[0].records.find(
    (r) => r.type === "OPTIONEXPIRATION",
  )!;
  expect(event.cashFlow.amount.provenance.provider).toBe("snaptrade");
});
it("does not treat blank expiry amounts or commissions as zero", () => {
  const { ledger } = calculate([open, expiry]);
  expect(ledger.trades.every((t) => t.status === "needs-review")).toBe(true);
  expect(ledger.trades.every((t) => t.realizedPnl === null)).toBe(true);
});
it("uses source-local ordering without manufacturing UTC execution timestamps", () => {
  const sameDay = close
    .replace("2026-09-02", "2026-09-01")
    .replace("10:00:00", "11:00:00");
  const { result, ledger } = calculate([sameDay, open]);
  expect(
    result.histories[0].records.every((t) => t.tradeDate.instant === null),
  ).toBe(true);
  expect(ledger.trades[0].realizedPnl).toBe("57");
});
it("keeps equal local times ambiguous, including equivalent fractional spellings", () => {
  const tied = close
    .replace("2026-09-02", "2026-09-01")
    .replace("10:00:00", "10:00:00.000");
  expect(
    calculate([open, tied]).ledger.trades.every((t) => t.realizedPnl === null),
  ).toBe(true);
});
it("retains API observations outside CSV dates and discloses excluded unallocated account fees", () => {
  const fee = normalizeTransaction(
    {
      id: "account-fee",
      type: "FEE",
      amount: -5,
      fee: 0,
      trade_date: "2026-09-01",
      currency: { code: "USD" },
    },
    "sdk",
  );
  const older = {
    ...sdkExpiry(),
    id: "older",
    tradeDate: {
      ...sdkExpiry().tradeDate,
      day: "2026-08-01",
      raw: "2026-08-01",
    },
  };
  const { result } = calculate([open, close], [fee, older]);
  expect(result.counts.unallocatedAccountFees).toBe(1);
  expect(result.histories[0].records.some((t) => t.id === "older")).toBe(true);
});
it("does not activate CSV history without an unambiguous account map or on failed synchronization", () => {
  const original = input([sdkExpiry()]);
  original[0].issues.push("Initial sync incomplete");
  expect(
    csvOptionHistory(original, parse([open, close]), mappings).histories[0],
  ).toBe(original[0]);
  expect(
    csvOptionHistory(input(), parse([open, close]), new Map()).counts
      .csvOptionRows,
  ).toBe(0);
});
it("keeps repeated source fills unresolved", () => {
  expect(
    calculate([open, open, close]).ledger.trades.every(
      (t) => t.realizedPnl === null,
    ),
  ).toBe(true);
});

it("does not override a contradictory explicit brokerage action with a CSV side interpretation", () => {
  const api = normalizeTransaction(
    {
      id: "explicit-source",
      type: "SELL",
      option_type: "SELL_TO_CLOSE",
      units: 1,
      amount: 100,
      fee: 2,
      trade_date: "2026-09-01",
      currency: { code: "USD" },
      option_symbol: {
        id: "synthetic-option",
        ticker: symbol,
        option_type: "CALL",
        strike_price: 100,
        expiration_date: "2026-10-16",
        underlying_symbol: { symbol: "SYNTH" },
      },
    },
    "sdk",
  );
  const { ledger } = calculate([open, close], [api]);
  expect(ledger.trades.every((t) => t.realizedPnl === null)).toBe(true);
});
