import "server-only";
import type { Result, ExchangeRate } from "@/lib/types";
export const RATE_URL =
  "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1";
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
export function parseExchangeRate(
  body: unknown,
  now = Date.now(),
): ExchangeRate {
  if (!record(body) || !Array.isArray(body.observations))
    throw new Error("Invalid rate response");
  const observation = body.observations[0];
  if (
    !record(observation) ||
    typeof observation.d !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(observation.d) ||
    !record(observation.FXUSDCAD)
  )
    throw new Error("Invalid observation");
  const raw = observation.FXUSDCAD.v;
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Missing rate");
  const cadPerUsd = Number(raw);
  const day = Date.parse(`${observation.d}T00:00:00Z`);
  if (
    !Number.isFinite(cadPerUsd) ||
    cadPerUsd <= 0 ||
    !Number.isFinite(day) ||
    new Date(day).toISOString().slice(0, 10) !== observation.d ||
    now - day > 7 * 86400000 ||
    day - now > 86400000
  )
    throw new Error("Invalid or stale rate");
  return { cadPerUsd, asOf: observation.d };
}
export async function loadExchangeRate(): Promise<Result<ExchangeRate>> {
  try {
    const response = await fetch(RATE_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Rate unavailable");
    return { status: "ok", data: parseExchangeRate(await response.json()) };
  } catch {
    return {
      status: "error",
      message:
        "Bank of Canada rate unavailable or over 7 days old. Separate CAD and USD values remain available; the converted total cannot be calculated.",
    };
  }
}
