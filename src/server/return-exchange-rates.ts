import "server-only";
import type { TransactionHistory } from "@/lib/holding-returns";
import { calendarToday, historyDate } from "@/lib/performance";
export type HistoricalRate = { date: string; cadPerUsd: number };
export const HISTORICAL_FX_NOTE =
  "Historical FX estimate: Bank of Canada daily reference rates, using the latest published rate on or before each transaction (at most 7 days earlier). Actual brokerage rates and spreads may differ.";
export function parseHistoricalRates(body: unknown): HistoricalRate[] {
  if (
    typeof body !== "object" ||
    body === null ||
    !("observations" in body) ||
    !Array.isArray(body.observations)
  )
    throw Error("Invalid rate response");
  const rates = new Map<string, number>();
  for (const row of body.observations) {
    if (
      !row ||
      typeof row.d !== "string" ||
      historyDate(row.d) !== row.d ||
      typeof row.FXUSDCAD?.v !== "string" ||
      !row.FXUSDCAD.v.trim()
    )
      continue;
    const value = Number(row.FXUSDCAD.v);
    if (Number.isFinite(value) && value > 0) rates.set(row.d, value);
  }
  return [...rates]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, cadPerUsd]) => ({ date, cadPerUsd }));
}
export function applyHistoricalReturnRates(
  histories: TransactionHistory[],
  rates: HistoricalRate[],
  today = calendarToday(),
): TransactionHistory[] {
  const observations = [...rates]
    .filter(
      (r) =>
        historyDate(r.date) && r.cadPerUsd > 0 && Number.isFinite(r.cadPerUsd),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return histories.map((h) => ({
    ...h,
    transactions: h.transactions.map((t) => {
      if (
        !t.fxConvertible ||
        !t.date ||
        t.date > today ||
        t.amount === null ||
        !["CAD", "USD"].includes(t.currency) ||
        !["CAD", "USD"].includes(t.securityCurrency || "") ||
        t.currency === t.securityCurrency
      )
        return t;
      const rate = observations.find(
        (r) =>
          r.date <= t.date! &&
          Date.parse(t.date!) - Date.parse(r.date) <= 7 * 86400000,
      );
      if (!rate) return t;
      const convert = (value: number | null) =>
        value === null
          ? null
          : t.currency === "CAD"
            ? value / rate.cadPerUsd
            : value * rate.cadPerUsd;
      const amount = convert(t.amount),
        price = convert(t.price),
        fee = convert(t.fee);
      if ([amount, price, fee].some((v) => v !== null && !Number.isFinite(v)))
        return t;
      return {
        ...t,
        currency: t.securityCurrency!,
        amount,
        price,
        fee,
        issue: undefined,
        fxConvertible: false,
        fxAsOf: rate.date,
        note: HISTORICAL_FX_NOTE,
      };
    }),
  }));
}
export async function loadReturnExchangeRates(
  histories: TransactionHistory[],
  fetcher: typeof fetch = fetch,
): Promise<{ histories: TransactionHistory[]; warnings: string[] }> {
  const today = calendarToday();
  const dates = histories
    .flatMap((h) =>
      h.transactions.flatMap((t) =>
        t.fxConvertible && t.date && t.date <= today && t.amount !== null
          ? [t.date]
          : [],
      ),
    )
    .sort();
  if (!dates.length) return { histories, warnings: [] };
  const start = new Date(Date.parse(dates[0]) - 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const url = new URL(
    "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json",
  );
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", dates[dates.length - 1]);
  try {
    // One public request for the date range. No brokerage identifiers or amounts
    // are sent to the Bank of Canada, and no financial data is persisted.
    const response = await fetcher(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error("Rates unavailable");
    const rates = parseHistoricalRates(await response.json());
    const converted = applyHistoricalReturnRates(histories, rates, today);
    const missing = converted.some((h) =>
      h.transactions.some((t) => t.fxConvertible),
    );
    return {
      histories: converted,
      warnings: missing
        ? [
            "Some historical currency conversions remain unavailable. Those records still require FX data; today's rate has not been substituted.",
          ]
        : [],
    };
  } catch {
    return {
      histories,
      warnings: [
        "Historical Bank of Canada rates could not be loaded. Cross-currency returns remain unavailable; no current-rate fallback was used.",
      ],
    };
  }
}
