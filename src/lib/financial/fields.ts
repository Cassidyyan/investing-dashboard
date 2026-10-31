import { decimal } from "./decimal";
import { calendarDay, currencyCode, nonEmptyText } from "./validation";
import type {
  DecimalField,
  FinancialDate,
  FinancialField,
  Provenance,
} from "./types";
export function decimalField(
  raw: unknown,
  provenance: Provenance,
): DecimalField {
  const value = decimal(raw);
  if (value !== null) return { status: "confirmed", value, provenance };
  return {
    status: raw == null || raw === "" ? "missing" : "unsupported",
    value: null,
    provenance,
    reason: "Missing or invalid finite decimal.",
  };
}
export function textField(
  raw: unknown,
  provenance: Provenance,
): FinancialField<string> {
  const value = nonEmptyText(raw);
  return value
    ? { status: "confirmed", value, provenance }
    : {
        status: "missing",
        value: null,
        provenance,
        reason: "Source field is unavailable.",
      };
}
export function currencyField(
  raw: unknown,
  provenance: Provenance,
): FinancialField<string> {
  const value = currencyCode(raw);
  return value
    ? { status: "confirmed", value, provenance }
    : {
        status: raw == null ? "missing" : "unsupported",
        value: null,
        provenance,
        reason: "A valid three-letter source currency is required.",
      };
}
export function financialDate(raw: unknown): FinancialDate {
  const text = nonEmptyText(raw),
    day = calendarDay(text);
  if (!text)
    return { raw: null, day: null, instant: null, precision: "missing" };
  if (!day)
    return { raw: text, day: null, instant: null, precision: "invalid" };
  // Midnight placeholders cannot prove execution ordering; preserve the raw value.
  const dayOnly =
    text.length === 10 || /T00:00:00(?:\.0+)?(?:Z|\+00:00)$/.test(text);
  return {
    raw: text,
    day,
    instant: dayOnly ? null : new Date(text).toISOString(),
    precision: dayOnly ? "day" : "timestamp",
  };
}
