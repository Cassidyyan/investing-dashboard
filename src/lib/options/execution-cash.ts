import type { OptionsCurrencyPolicy } from "@/lib/config";
import {
  absoluteDecimal,
  addDecimal,
  compareDecimal,
  decimal,
  multiplyDecimal,
  subtractDecimal,
} from "@/lib/financial/decimal";
import type { NormalizedTransaction } from "@/lib/financial/transactions";
import type { ExecutionCash } from "./analytics-types";
import { applyOptionsCurrency, isAssumedOptionsCurrency } from "./currency";
const zero = decimal("0")!;
// Source amount is a signed cash amount; with zero fees its gross/net ambiguity
// vanishes. Nonzero fees require an explicit multiplier and an exact source-price
// reconciliation. No default multiplier, inferred commission or implied price.
export function executionCash(
  t: NormalizedTransaction,
  policy: OptionsCurrencyPolicy = "reported",
): ExecutionCash {
  t = applyOptionsCurrency(t, policy);
  const amount = t.cashFlow.amount.value,
    fee = t.fee.amount.value;
  const currency = t.cashFlow.currency.value;
  const result: ExecutionCash = {
    premium: null,
    net: null,
    fee,
    currency,
    convention: "unresolved",
    issues: [],
  };
  if (amount === null || !currency)
    result.issues.push("Missing signed cash amount or transaction currency.");
  if (
    t.cashFlow.amount.status !== "confirmed" ||
    t.fee.amount.status !== "confirmed" ||
    (t.cashFlow.currency.status !== "confirmed" &&
      !isAssumedOptionsCurrency(t.cashFlow.currency))
  )
    result.issues.push(
      "Realized accounting requires reported cash, fees and native currency; estimates are not substituted.",
    );
  if (fee === null || (fee !== null && compareDecimal(fee, zero) < 0))
    result.issues.push(
      "Missing, invalid or negative fees; no zero fee is assumed.",
    );
  if (t.fee.currency.value !== currency)
    result.issues.push("Fee currency cannot be reconciled to cash currency.");
  const sell = t.optionAction.startsWith("SELL"),
    buy = t.optionAction.startsWith("BUY");
  const csvNet =
    t.cashConvention === "reported-net" &&
    t.importEvidence?.source === "wealthsimple-csv" &&
    t.netAmount.amount.provenance.provider === "wealthsimple-csv" &&
    t.netAmount.amount.status === "confirmed" &&
    t.netAmount.amount.value === amount;
  const directionAmount =
    csvNet && amount !== null && fee !== null
      ? addDecimal(amount, fee)
      : amount;
  if (!sell && !buy)
    result.issues.push("Opening/closing action is unavailable.");
  if (
    directionAmount !== null &&
    ((buy && compareDecimal(directionAmount, zero) > 0) ||
      (sell && compareDecimal(directionAmount, zero) < 0))
  )
    result.issues.push("Cash direction conflicts with the option action.");
  if (
    t.price.amount.status === "unsupported" ||
    (t.price.amount.value !== null &&
      compareDecimal(t.price.amount.value, zero) < 0)
  )
    result.issues.push("Invalid execution price.");
  if (t.option?.multiplier.status === "unsupported")
    result.issues.push("Invalid contract multiplier.");
  if (t.issues.some((i) => i.severity === "blocking"))
    result.issues.push("Source transaction needs reconciliation.");
  if (result.issues.length || amount === null || fee === null) return result;
  if (csvNet) {
    const premium = addDecimal(amount, fee);
    if (t.price.amount.value === zero && premium !== zero) {
      result.issues.push(
        "Zero execution price conflicts with reported gross cash.",
      );
      return result;
    }
    return { ...result, premium, net: amount, convention: "net" };
  }
  const price = t.price.amount.value,
    quantity = t.quantity.value,
    multiplier =
      t.option?.multiplier.status === "confirmed"
        ? t.option.multiplier.value
        : null;
  let expected =
    price !== null && quantity !== null && multiplier != null
      ? multiplyDecimal(
          multiplyDecimal(price, absoluteDecimal(quantity)),
          multiplier,
        )
      : null;
  if (price === zero && amount !== zero)
    result.issues.push("Zero execution price conflicts with nonzero cash.");
  if (price !== null && compareDecimal(price, zero) > 0 && amount === zero)
    result.issues.push("Positive execution price conflicts with zero cash.");
  if (result.issues.length) return result;
  if (fee === zero) {
    if (
      expected !== null &&
      compareDecimal(expected, absoluteDecimal(amount)) !== 0
    )
      result.issues.push(
        "Price, quantity and multiplier do not reconcile to cash.",
      );
    if (!result.issues.length)
      return {
        ...result,
        premium: amount,
        net: amount,
        convention: "zero-fee",
      };
    return result;
  }
  if (expected === null) {
    result.issues.push(
      "Nonzero fee gross/net convention needs a confirmed multiplier and execution price.",
    );
    return result;
  }
  if (t.price.amount.status !== "confirmed") {
    result.issues.push(
      "Nonzero-fee reconciliation requires a reported execution price.",
    );
    return result;
  }
  if (buy) expected = subtractDecimal(zero, expected);
  const expectedNet = subtractDecimal(expected, fee);
  if (compareDecimal(amount, expectedNet) === 0)
    return { ...result, premium: expected, net: amount, convention: "net" };
  if (compareDecimal(amount, expected) === 0)
    return {
      ...result,
      premium: expected,
      net: expectedNet,
      convention: "gross",
    };
  // Some short executions have premiums smaller than fees. They require an explicit
  // policy; negative reported sale cash is conservatively unresolved above.
  result.issues.push(
    "Reported cash does not reconcile to gross or net premium and fees.",
  );
  return result;
}
