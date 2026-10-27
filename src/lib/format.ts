// Display helpers shared by the components; these functions do not fetch data.
import type { Money } from "./types";
export function money(value: Money): string {
  if (value.amount === null) return "Unavailable";
  if (!value.currency)
    return `${value.amount.toLocaleString("en-CA")} (currency unknown)`;
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: value.currency,
      currencyDisplay: "code",
    }).format(value.amount);
  } catch {
    return `${value.amount.toLocaleString("en-CA")} ${value.currency}`;
  }
}
export function date(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return "Unavailable";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}
export function quantity(value: number | null) {
  return value === null
    ? "Unavailable"
    : value.toLocaleString("en-CA", { maximumFractionDigits: 8 });
}

export function signedMoney(value: Money): string {
  return `${value.amount !== null && value.amount > 0 ? "+" : ""}${money(value)}`;
}
export function signedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "Unavailable";
  return new Intl.NumberFormat("en-CA", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value / 100);
}
