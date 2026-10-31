import type { Decimal } from "./decimal";
export type Provenance = {
  provider:
    | "snaptrade"
    | "occ-symbol"
    | "application"
    | "manual"
    | "market-data"
    | "wealthsimple-csv";
  field: string;
  recordId?: string;
  asOf?: string;
  method?: string;
};
// 'confirmed' means a valid reported field, not independently verified brokerage truth.
export type FinancialField<T> =
  | {
      status: "confirmed" | "calculated" | "estimated";
      value: T;
      provenance: Provenance;
    }
  | {
      status: "missing" | "unsupported";
      value: null;
      provenance: Provenance;
      reason: string;
    };
export type DecimalField = FinancialField<Decimal>;
export type MoneyField = {
  amount: DecimalField;
  currency: FinancialField<string>;
};
export type DataIssue = {
  code: string;
  field: string;
  severity: "warning" | "blocking";
};
export type FinancialDate = {
  sourceOrder?: { clock: string; key: string };
  raw: string | null;
  day: string | null;
  instant: string | null;
  precision: "day" | "timestamp" | "missing" | "invalid";
};
export type EntryDelta =
  | {
      status: "observed" | "manually-entered" | "estimated";
      value: Decimal;
      asOf: string;
      provenance: Provenance;
    }
  | { status: "unavailable"; value: null; reason: string };
export function unavailableDelta(): EntryDelta {
  return {
    status: "unavailable",
    value: null,
    reason:
      "Historical entry delta is not supplied by the connected activity/position adapter.",
  };
}
