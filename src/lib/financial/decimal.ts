// Exact, bounded base-10 arithmetic for future accounting. No implicit rounding.
// Decimal strings are serializable; bigint coefficients stay inside these helpers.
declare const decimalBrand: unique symbol;
export type Decimal = string & { readonly [decimalBrand]: true };
const LIMIT = 100;
function parts(value: string) {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  return {
    coefficient: BigInt((negative ? "-" : "") + whole + fraction),
    scale: fraction.length,
  };
}
function render(coefficient: bigint, scale: number): Decimal {
  const sign = coefficient < 0n ? "-" : "";
  let text = (coefficient < 0n ? -coefficient : coefficient)
    .toString()
    .padStart(scale + 1, "0");
  if (scale) text = text.slice(0, -scale) + "." + text.slice(-scale);
  text = text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return ((coefficient === 0n ? "" : sign) + text) as Decimal;
}
export function decimal(value: unknown): Decimal | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  const text = String(value)
    .trim()
    .replace(/^([+-]?)\./, (_, sign: string) => `${sign}0.`)
    .replace(/\.(?=e|$)/i, "");
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(text);
  if (!match || text.length > LIMIT * 2) return null;
  const exponent = Number(match[4] || 0),
    fraction = match[3] || "";
  if (
    !Number.isInteger(exponent) ||
    Math.abs(exponent) > LIMIT ||
    match[2].length + fraction.length > LIMIT
  )
    return null;
  let coefficient = BigInt((match[1] === "-" ? "-" : "") + match[2] + fraction);
  let scale = fraction.length - exponent;
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return render(coefficient, scale);
}
function align(a: Decimal, b: Decimal) {
  const left = parts(a),
    right = parts(b),
    scale = Math.max(left.scale, right.scale);
  return {
    left: left.coefficient * 10n ** BigInt(scale - left.scale),
    right: right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  };
}
export function addDecimal(a: Decimal, b: Decimal): Decimal {
  const p = align(a, b);
  return render(p.left + p.right, p.scale);
}
export function subtractDecimal(a: Decimal, b: Decimal): Decimal {
  const p = align(a, b);
  return render(p.left - p.right, p.scale);
}
export function multiplyDecimal(a: Decimal, b: Decimal): Decimal {
  const l = parts(a),
    r = parts(b);
  return render(l.coefficient * r.coefficient, l.scale + r.scale);
}
export function compareDecimal(a: Decimal, b: Decimal): number {
  const p = align(a, b);
  return p.left < p.right ? -1 : p.left > p.right ? 1 : 0;
}
export function absoluteDecimal(value: Decimal): Decimal {
  return value.replace(/^-/, "") as Decimal;
}
// Used only by existing numeric view models, never as the accounting representation.
export function decimalNumber(value: Decimal | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
