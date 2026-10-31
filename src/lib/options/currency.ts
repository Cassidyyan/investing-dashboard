import type { OptionsCurrencyPolicy } from "@/lib/config";
import type { FinancialField, MoneyField } from "@/lib/financial/types";
import type { NormalizedTransaction } from "@/lib/financial/transactions";

// Optional installation policy. This changes the assumed denomination, never the amount.
export const OPTIONS_CURRENCY = "USD" as const;
export const OPTIONS_CURRENCY_NOTE =
  "All options are assumed to be USD. Amounts are unchanged; no currency conversion is applied.";
const field = "options.currency_policy";
export function optionsCurrency(
  reported: FinancialField<string>,
): FinancialField<string> {
  if (reported.status === "confirmed" && reported.value === OPTIONS_CURRENCY)
    return reported;
  return {
    status: "estimated",
    value: OPTIONS_CURRENCY,
    provenance: {
      provider: "application",
      field,
      method: OPTIONS_CURRENCY_NOTE,
    },
  };
}
export function isAssumedOptionsCurrency(currency: FinancialField<string>) {
  return (
    currency.value === OPTIONS_CURRENCY &&
    currency.status === "estimated" &&
    currency.provenance.provider === "application" &&
    currency.provenance.field === field
  );
}
export function assumeOptionsUsd(
  t: NormalizedTransaction,
): NormalizedTransaction {
  if (!t.optionRelated) return t;
  const money = (m: MoneyField): MoneyField => ({
    ...m,
    currency: optionsCurrency(m.currency),
  });
  return {
    ...t,
    cashFlow: money(t.cashFlow),
    fee: money(t.fee),
    price: money(t.price),
    grossAmount: money(t.grossAmount),
    netAmount: money(t.netAmount),
    option: t.option ? { ...t.option, strike: money(t.option.strike) } : null,
    sourceValues: {
      ...t.sourceValues,
      currency:
        "currency" in t.sourceValues
          ? t.sourceValues.currency
          : t.cashFlow.currency.value,
    },
  };
}

export function optionsCurrencyNote(policy: OptionsCurrencyPolicy) {
  return policy === "USD"
    ? OPTIONS_CURRENCY_NOTE
    : "Options keep their reported currency. Missing currencies stay unavailable; native currencies are never combined without conversion.";
}
export function applyOptionsCurrency(
  t: NormalizedTransaction,
  policy: OptionsCurrencyPolicy,
) {
  return policy === "USD" ? assumeOptionsUsd(t) : t;
}
