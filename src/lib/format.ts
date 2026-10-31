// Display helpers shared by the components; these functions do not fetch data.
import type { Money } from "@/lib/types";
export function cashMoney(value: Money): string {
  // A confirmed zero may be shortened; an unavailable amount is never zero.
  return value.currency === "USD" && value.amount === 0 ? "0" : money(value);
}
export function money(value: Money): string {
  if (value.amount === null || !Number.isFinite(value.amount))
    return "Unavailable";
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
  return value === null || !Number.isFinite(value)
    ? "Unavailable"
    : value.toLocaleString("en-CA", { maximumFractionDigits: 8 });
}

export function signedMoney(value: Money): string {
  return `${value.amount !== null && value.amount > 0 ? "+" : ""}${money(value)}`;
}
// Native numeric amount with currency precision, for tables labelled by currency.
export function signedAmount(value: Money): string {
  if (value.amount === null || !Number.isFinite(value.amount))
    return "Unavailable";
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: value.currency || "CAD",
    })
      .formatToParts(value.amount)
      .filter((part) => part.type !== "currency" && part.type !== "literal")
      .map((part) => part.value)
      .join("");
  } catch {
    formatted = value.amount.toLocaleString("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return `${value.amount > 0 ? "+" : ""}${formatted}`;
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
