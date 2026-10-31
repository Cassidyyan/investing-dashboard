import { decimal, compareDecimal } from "@/lib/financial/decimal";
import { currencyField, decimalField, textField } from "@/lib/financial/fields";
import { calendarDay, nonEmptyText } from "@/lib/financial/validation";
import type { FinancialField, Provenance } from "@/lib/financial/types";
import type { OptionContract } from "./types";
const zero = decimal("0")!;
export function parseOccSymbol(raw: unknown, referenceDay: string | null) {
  const symbol = nonEmptyText(raw)?.replace(/\s+/g, "");
  const m =
    symbol &&
    /^([A-Z0-9.]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(symbol);
  if (!m) return null;
  const suffix = Number(m[2]),
    month = m[3],
    day = m[4];
  let expiration: string | null = null;
  if (referenceDay && calendarDay(referenceDay)) {
    const reference = Number(referenceDay.slice(0, 4)),
      century = Math.floor(reference / 100) * 100;
    const year = [
      century - 100 + suffix,
      century + suffix,
      century + 100 + suffix,
    ].sort((a, b) => Math.abs(a - reference) - Math.abs(b - reference))[0];
    expiration = calendarDay(`${year}-${month}-${day}`);
    if (!expiration) return null;
  } else if (!calendarDay(`${2000 + suffix}-${month}-${day}`)) return null;
  const strike = decimal(`${BigInt(m[6]) / 1000n}.${m[6].slice(-3)}`)!;
  return {
    symbol,
    root: m[1],
    type: m[5] === "C" ? ("CALL" as const) : ("PUT" as const),
    strike,
    expiration,
    dateCode: m[2] + month + day,
  };
}
type ContractInput = {
  id?: unknown;
  symbol?: unknown;
  type?: unknown;
  strike?: unknown;
  expiration?: unknown;
  multiplier?: unknown;
  currency?: unknown;
  underlyingId?: unknown;
  underlyingTicker?: unknown;
  referenceDay?: string | null;
};
export function normalizeOptionContract(
  input: ContractInput,
  source: OptionContract["source"],
): OptionContract {
  const provenance = (field: string): Provenance => ({
    provider: "snaptrade",
    field: `${source}.${field}`,
  });
  const rawExpiration = nonEmptyText(input.expiration),
    day = calendarDay(rawExpiration);
  const parsed = parseOccSymbol(
    input.symbol,
    day || input.referenceDay || null,
  );
  const issues: OptionContract["issues"] = [];
  const parsedSource = (field: string): Provenance => ({
    provider: "occ-symbol",
    field,
    method:
      "Parsed OCC components; century resolved from a supplied source date.",
  });
  const type: OptionContract["type"] =
    input.type === "CALL" || input.type === "PUT"
      ? {
          status: "confirmed",
          value: input.type,
          provenance: provenance("option_type"),
        }
      : input.type == null && parsed
        ? {
            status: "calculated",
            value: parsed.type,
            provenance: parsedSource("right"),
          }
        : {
            status: input.type == null ? "missing" : "unsupported",
            value: null,
            provenance: provenance("option_type"),
            reason: "Unrecognized or missing option right.",
          };
  let strike = decimalField(input.strike, provenance("strike_price"));
  if (strike.value !== null && compareDecimal(strike.value, zero) < 0)
    strike = {
      status: "unsupported",
      value: null,
      provenance: provenance("strike_price"),
      reason: "Strike cannot be negative.",
    };
  if (input.strike == null && parsed)
    strike = {
      status: "calculated",
      value: parsed.strike,
      provenance: parsedSource("strike"),
    };
  const expiration: FinancialField<string> = rawExpiration
    ? day && rawExpiration.length === 10
      ? {
          status: "confirmed",
          value: day,
          provenance: provenance("expiration_date"),
        }
      : {
          status: "unsupported",
          value: null,
          provenance: provenance("expiration_date"),
          reason: "Invalid source expiration date.",
        }
    : parsed?.expiration
      ? {
          status: "calculated",
          value: parsed.expiration,
          provenance: parsedSource("expiration"),
        }
      : { ...textField(null, provenance("expiration_date")) };
  let multiplier = decimalField(input.multiplier, provenance("multiplier"));
  if (multiplier.value !== null && compareDecimal(multiplier.value, zero) <= 0)
    multiplier = {
      status: "unsupported",
      value: null,
      provenance: provenance("multiplier"),
      reason: "Multiplier must be positive.",
    };
  if (source !== "position" && input.multiplier == null)
    multiplier = {
      status: "missing",
      value: null,
      provenance: provenance("multiplier"),
      reason:
        "Legacy activity/order option symbols do not report an explicit contract multiplier; 100 is not assumed.",
    };
  if (
    parsed &&
    ((type.value && type.value !== parsed.type) ||
      (strike.value !== null &&
        compareDecimal(strike.value, parsed.strike) !== 0) ||
      (expiration.value &&
        parsed.expiration &&
        expiration.value !== parsed.expiration))
  )
    issues.push({
      code: "contract_symbol_conflict",
      field: "contract",
      severity: "blocking",
    });
  return {
    id: nonEmptyText(input.id),
    symbol: parsed?.symbol || nonEmptyText(input.symbol),
    occRoot: parsed?.root || null,
    underlyingId: nonEmptyText(input.underlyingId),
    underlyingTicker: nonEmptyText(input.underlyingTicker),
    type,
    strike: {
      amount: strike,
      currency: currencyField(input.currency, provenance("currency")),
    },
    expiration,
    multiplier,
    source,
    issues,
  };
}
export function optionContractKey(contract: OptionContract): string | null {
  if (
    contract.issues.some((i) => i.severity === "blocking") ||
    !contract.symbol ||
    !contract.type.value ||
    !contract.strike.amount.value ||
    !contract.expiration.value
  )
    return null;
  // Provider IDs occupy different namespaces across legacy activities and unified positions.
  return JSON.stringify([
    contract.symbol,
    contract.type.value,
    contract.strike.amount.value,
    contract.expiration.value,
  ]);
}
