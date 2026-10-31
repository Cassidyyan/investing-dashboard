import "server-only";
import { activityType } from "@/lib/financial/activity-types";
import type { UniversalActivity } from "snaptrade-typescript-sdk";
import {
  calendarDay,
  nonEmptyText,
  numeric,
  currencyCode,
} from "@/lib/financial/validation";
import type {
  TransactionCoverage,
  TransactionSync,
} from "@/lib/financial/history-coverage";

export function transactionSync(
  raw:
    | {
        initial_sync_completed?: boolean;
        first_transaction_date?: string | null;
        last_successful_sync?: string | null;
      }
    | undefined,
): TransactionSync {
  return {
    initialSyncCompleted:
      typeof raw?.initial_sync_completed === "boolean"
        ? raw.initial_sync_completed
        : null,
    firstTransactionDate: calendarDay(raw?.first_transaction_date),
    lastSuccessfulSync: calendarDay(raw?.last_successful_sync),
    invalidMetadata: !!(
      (raw?.first_transaction_date &&
        !calendarDay(raw.first_transaction_date)) ||
      (raw?.last_successful_sync && !calendarDay(raw.last_successful_sync))
    ),
  };
}
export function historyQuality(
  records: readonly UniversalActivity[],
): Pick<
  TransactionCoverage,
  "earliest" | "latest" | "optionRecords" | "events" | "fields"
> {
  const dates = records
    .map((t) => calendarDay(t.trade_date) || calendarDay(t.settlement_date))
    .filter((d): d is string => d !== null)
    .sort();
  const options = records.filter(
    (t) =>
      t.option_symbol ||
      t.option_type ||
      (typeof t.type === "string" && t.type.startsWith("OPTION")),
  );
  const trades = records.filter((t) => t.type === "BUY" || t.type === "SELL");
  const equities = trades.filter((t) => !t.option_symbol && !t.option_type);
  const optionTrades = options.filter(
    (t) => t.type === "BUY" || t.type === "SELL",
  );
  const fields: TransactionCoverage["fields"] = [];
  function field(
    name: string,
    rows: readonly UniversalActivity[],
    read: (t: UniversalActivity) => unknown,
    valid: (v: unknown) => boolean,
  ) {
    const values = rows.map(read);
    fields.push({
      field: name,
      applicable: values.length,
      missing: values.filter((v) => v == null || v === "").length,
      invalid: values.filter((v) => v != null && v !== "" && !valid(v)).length,
    });
  }
  const text = (v: unknown) => nonEmptyText(v) !== null,
    number = (v: unknown) => numeric(v) !== null,
    date = (v: unknown) => calendarDay(v) !== null;
  field("Trade date", records, (t) => t.trade_date, date);
  field("Settlement date", records, (t) => t.settlement_date, date);
  field("Equity ticker", equities, (t) => t.symbol?.symbol, text);
  field("Raw equity ticker", equities, (t) => t.symbol?.raw_symbol, text);
  field("Security identifier", equities, (t) => t.symbol?.id, text);
  field(
    "Option contract identifier",
    options,
    (t) => t.option_symbol?.id,
    text,
  );
  field(
    "Option contract symbol",
    options,
    (t) => t.option_symbol?.ticker,
    text,
  );
  field(
    "Option direction",
    optionTrades,
    (t) => t.option_type,
    (v) =>
      ["BUY_TO_OPEN", "BUY_TO_CLOSE", "SELL_TO_OPEN", "SELL_TO_CLOSE"].includes(
        String(v),
      ),
  );
  field(
    "Option strike",
    options,
    (t) => t.option_symbol?.strike_price,
    (v) => number(v) && numeric(v)! >= 0,
  );
  field(
    "Option expiration",
    options,
    (t) => t.option_symbol?.expiration_date,
    date,
  );
  field(
    "Explicit option multiplier",
    options,
    (t) => t.option_symbol?.multiplier,
    (v) => number(v) && numeric(v)! > 0,
  );
  field("Quantity", trades, (t) => t.units, number);
  field(
    "Execution price",
    trades,
    (t) => t.price,
    (v) => number(v) && numeric(v)! >= 0,
  );
  field("Cash amount", records, (t) => t.amount, number);
  field(
    "Currency",
    records,
    (t) => t.currency?.code,
    (v) => currencyCode(v) !== null,
  );
  field(
    "Trade fee",
    trades,
    (t) => t.fee,
    (v) => number(v) && numeric(v)! >= 0,
  );
  field("Brokerage reference", records, (t) => t.external_reference_id, text);
  return {
    earliest: dates[0] || null,
    latest: dates.at(-1) || null,
    optionRecords: options.length,
    events: {
      assignment: options.filter(
        (t) => activityType(t.type || "") === "OPTIONASSIGNMENT",
      ).length,
      exercise: options.filter(
        (t) => activityType(t.type || "") === "OPTIONEXERCISE",
      ).length,
      expiration: options.filter(
        (t) => activityType(t.type || "") === "OPTIONEXPIRATION",
      ).length,
    },
    fields,
  };
}
