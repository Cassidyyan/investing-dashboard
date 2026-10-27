import type { AccountData, PositionView } from "@/lib/types";
import { isOption } from "@/lib/holdings";

export function expirationDate(raw: string | null | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(raw)) return null;
  const value = raw.slice(0, 10);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
    ? value
    : null;
}
export function daysToExpiration(
  raw: string | null | undefined,
  now = new Date(),
): number | null {
  const expiry = expirationDate(raw);
  if (!expiry) return null;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return Math.round(
    (Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );
}
export function formatExpiration(raw: string | null | undefined): string {
  const expiry = expirationDate(raw);
  return expiry
    ? new Intl.DateTimeFormat("en-CA", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(`${expiry}T00:00:00Z`))
    : "Unavailable";
}

// Only use actual matching held-position prices, never the option premium as spot.
export function findUnderlyingPrice(
  option: PositionView,
  accounts: AccountData[],
  now = Date.now(),
) {
  const details = option.optionDetails;
  if (
    !details?.strike.currency ||
    (!details.underlyingId && !details.underlyingSymbol)
  )
    return null;
  const candidates = accounts.flatMap((account) => {
    if (
      account.account.stale ||
      account.account.incomplete ||
      account.positions.status !== "ok"
    )
      return [];
    const { rows, asOf } = account.positions.data;
    const time = asOf ? Date.parse(asOf) : NaN;
    if (
      !Number.isFinite(time) ||
      now - time > 36 * 3600000 ||
      time - now > 5 * 60000
    )
      return [];
    return rows
      .filter(
        (p) =>
          !isOption(p.kind) &&
          p.units !== 0 &&
          p.price.amount !== null &&
          p.price.amount > 0 &&
          Number.isFinite(p.price.amount) &&
          p.price.currency === details.strike.currency &&
          (details.underlyingId
            ? p.instrumentId === details.underlyingId
            : p.symbol === details.underlyingSymbol &&
              p.kind === details.underlyingKind),
      )
      .map((p) => ({ price: p.price, asOf: asOf!, time }));
  });
  return candidates.sort((a, b) => b.time - a.time)[0] ?? null;
}

export function moneyness(
  type: "CALL" | "PUT" | null | undefined,
  strike: number | null | undefined,
  underlying: number | null | undefined,
  days: number | null,
): string {
  if (days !== null && days < 0) return "Expired";
  if (
    !type ||
    strike == null ||
    underlying == null ||
    !Number.isFinite(strike) ||
    !Number.isFinite(underlying) ||
    strike <= 0 ||
    underlying <= 0
  )
    return "Unavailable";
  // ATM is a display convention: within 0.5% of strike, not an exercise signal.
  if (Math.abs(underlying - strike) / strike <= 0.005 + Number.EPSILON)
    return "At the money";
  const inMoney = type === "CALL" ? underlying > strike : underlying < strike;
  return inMoney ? "In the money" : "Out of the money";
}
