import { decimal, type Decimal } from "@/lib/financial/decimal";
import { calendarDay, currencyCode } from "@/lib/financial/validation";
import { parseOccSymbol } from "@/lib/options/contracts";

const required = [
  "effective_date",
  "account_id",
  "activity_type",
  "activity_sub_type",
  "symbol",
  "currency",
  "quantity",
  "unit_price",
  "commission",
  "net_cash_amount",
];
export type ImportedOptionActivity = {
  row: number;
  date: string | null;
  symbol: string;
  action: string;
  explicitAction: boolean;
  side: "LONG" | "SHORT" | null;
  candidateAction: string | null;
  currency: string | null;
  quantity: Decimal | null;
  price: Decimal | null;
  commission: Decimal | null;
  netCash: Decimal | null;
  issues: string[];
};
export type ActivityPreviewRow = ImportedOptionActivity & {
  id: string;
  account: string;
  source: string;
  possibleDuplicate: boolean;
};
export type ActivityImportPreview = {
  files: number;
  records: number;
  accounts: number;
  earliest: string | null;
  latest: string | null;
  possibleDuplicates: number;
  rows: ActivityPreviewRow[];
  warnings: string[];
};
// Server reconciliation input. Raw source account IDs never enter preview props.
export type CsvActivity = {
  settlementDate?: string | null;
  localTime?: string;
  accountId: string;
  fingerprint: string;
  activity: ImportedOptionActivity;
  option: boolean;
  activityType: string;
};
export type ImportReconciliation = {
  optionsSource?: "csv";
  csvOptionRows?: number;
  overlappingApiOptions?: number;
  unallocatedAccountFees?: number;
  pendingAdditional?: number;
  matched: number;
  added: number;
  conflicts: number;
  unmatched: number;
  mappedAccounts: number;
};

// Strict RFC-style comma CSV: quoted commas/newlines and escaped double quotes.
// Reject malformed quoting rather than shifting financial values into columns.
export function parseCsv(text: string): string[][] {
  if (text.length > 10_000_000 || text.includes("\0"))
    throw Error("invalid_csv");
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const field = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  const line = () => {
    field();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
    if (rows.length > 20_001) throw Error("row_limit");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === ",") field();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      line();
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else {
      if (closed || c === '"') throw Error("invalid_quotes");
      cell += c;
    }
  }
  if (quoted) throw Error("unclosed_quote");
  if (cell !== "" || row.length || closed) line();
  return rows;
}

export function parseWealthsimpleActivity(text: string) {
  const [header, ...records] = parseCsv(text);
  if (
    !header ||
    new Set(header).size !== header.length ||
    required.some((h) => !header.includes(h))
  )
    throw Error("unsupported_schema");
  const rows: {
    accountId: string;
    fingerprint: string;
    activity: ImportedOptionActivity;
  }[] = [];
  const activities: CsvActivity[] = [];
  let rejected = 0;
  const dates: string[] = [];
  const accounts = new Set<string>();
  for (const [index, fields] of records.entries()) {
    if (fields.length !== header.length) {
      rejected++;
      continue;
    }
    const record = Object.fromEntries(
      header.map((h, i) => [h, fields[i].trim()]),
    );
    const date = calendarDay(record.effective_date);
    if (date) dates.push(date);
    if (record.account_id) accounts.add(record.account_id);
    // Do not interpret arbitrary descriptions as contract identifiers.
    const contract = parseOccSymbol(record.symbol, date);
    const action =
      record.activity_sub_type || record.activity_type || "Unavailable";
    const explicitAction = [
      "BUY_TO_OPEN",
      "BUY_TO_CLOSE",
      "SELL_TO_OPEN",
      "SELL_TO_CLOSE",
    ].includes(action);
    const side =
      record.direction === "LONG" || record.direction === "SHORT"
        ? record.direction
        : null;
    // This export field's semantics need verification. Retain the source side
    // and label the interpretation as a candidate, never an explicit instruction.
    const candidateAction =
      explicitAction || !side || !["BUY", "SELL"].includes(action)
        ? null
        : `${action}_TO_${(side === "LONG" && action === "BUY") || (side === "SHORT" && action === "SELL") ? "OPEN" : "CLOSE"}`;
    const currency = currencyCode(record.currency);
    const quantity = decimal(record.quantity),
      price = decimal(record.unit_price),
      commission = decimal(record.commission),
      netCash = decimal(record.net_cash_amount);
    const issues: string[] = [];
    if (!record.account_id) issues.push("Missing source account.");
    if (!date) issues.push("Missing or invalid activity date.");
    if (!currency) issues.push("Missing or invalid currency.");
    if ([quantity, price, commission, netCash].some((v) => v === null))
      issues.push(
        "One or more numeric fields are missing or invalid; zero was not substituted.",
      );
    if (!explicitAction && ["BUY", "SELL"].includes(action))
      issues.push("Opening/closing direction is not supplied.");
    const parsed: CsvActivity = {
      settlementDate: calendarDay(record.settlement_date),
      ...(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?$/.test(
        record.effective_time || "",
      )
        ? {
            localTime: `${record.effective_time.split(".")[0]}.${(record.effective_time.split(".")[1] || "").padEnd(9, "0")}`,
          }
        : {}),
      accountId: record.account_id,
      fingerprint: JSON.stringify(fields),
      activity: {
        row: index + 2,
        date,
        symbol: contract?.symbol || record.symbol,
        action,
        explicitAction,
        side,
        candidateAction,
        currency,
        quantity,
        price,
        commission,
        netCash,
        issues,
      },
      option: !!contract,
      activityType: record.activity_type,
    };
    activities.push(parsed);
    if (contract) rows.push(parsed);
  }
  dates.sort();
  return {
    records: records.length,
    accounts,
    earliest: dates[0] || null,
    latest: dates.at(-1) || null,
    rejected,
    rows,
    activities,
  };
}
