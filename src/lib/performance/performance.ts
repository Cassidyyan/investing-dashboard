import type { HistoryPoint, PerformanceAccount } from "@/lib/types";
export const historyRanges = [
  "1D",
  "5D",
  "1M",
  "3M",
  "YTD",
  "1 Year",
  "5 Year",
] as const;
export type HistoryRange = (typeof historyRanges)[number];
export const returnTimeframes: Partial<Record<HistoryRange, string>> = {
  "1D": "1D",
  "1M": "1M",
  YTD: "YTD",
  "1 Year": "1Y",
};
export function historyDate(raw: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(raw)) return null;
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const time = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === day
    ? day
    : null;
}
export function calendarToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function monthsBefore(today: string, months: number) {
  const date = new Date(`${today}T00:00:00Z`),
    day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}
export function selectHistoryRange(
  points: HistoryPoint[],
  range: HistoryRange,
  today: string,
): HistoryPoint[] {
  if (!historyDate(today) || range === "5 Year") return [];
  const valid = points.filter((p) => p.date <= today);
  if (range === "1D") return valid.slice(-2);
  if (range === "5D") return valid.slice(-6);
  const cutoff =
    range === "YTD"
      ? `${today.slice(0, 4)}-01-01`
      : monthsBefore(today, range === "1M" ? 1 : range === "3M" ? 3 : 12);
  return valid.filter((p) => p.date >= cutoff);
}
// Require an actual value for every included account on a date. Never carry a
// missing balance forward, mix currencies, or treat a missing account as zero.
export function aggregateHistory(accounts: PerformanceAccount[]) {
  const grouped = new Map<
    string,
    { account: PerformanceAccount; points: Map<string, number> }[]
  >();
  for (const account of accounts) {
    if (account.history.status !== "ok") continue;
    const { currency, points } = account.history.data;
    grouped.set(currency, [
      ...(grouped.get(currency) || []),
      { account, points: new Map(points.map((p) => [p.date, p.value])) },
    ]);
  }
  return [...grouped].map(([currency, rows]) => {
    const dates = [
      ...new Set(rows.flatMap((row) => [...row.points.keys()])),
    ].sort();
    const points = dates
      .filter((day) => rows.every((row) => row.points.has(day)))
      .map((date) => ({
        date,
        value: rows.reduce((sum, row) => sum + row.points.get(date)!, 0),
      }))
      .filter((p) => Number.isFinite(p.value));
    return {
      currency,
      points,
      accountCount: rows.length,
      missingDates: dates.length - points.length,
    };
  });
}
export function historyChange(points: HistoryPoint[]) {
  if (points.length < 2) return { amount: null, percent: null };
  const start = points[0].value,
    end = points[points.length - 1].value;
  const amount = end - start;
  const percent = start > 0 ? (amount / start) * 100 : null;
  return {
    amount: Number.isFinite(amount) ? amount : null,
    percent: percent !== null && Number.isFinite(percent) ? percent : null,
  };
}
