import type { PerformanceAccount } from "@/lib/types";
import {
  aggregateHistory,
  historyChange,
  selectHistoryRange,
} from "@/lib/performance/performance";
import {
  aggregateFunding,
  cashFlowReturns,
} from "@/lib/performance/cash-flow-returns";
import type { Change, OverviewModel, OverviewRange } from "./overview";

export type OverviewHistory = {
  ranges: Record<OverviewRange, { label: string; value: number }[]>;
  dayChange: Change;
  gain: Change;
  gainMessage: string | null;
  period: string | null;
  asOf: string | null;
  accountCount: number;
  totalAccounts: number;
  missingDates: number;
};
export function connectOverviewHistory(
  model: OverviewModel,
  performance: PerformanceAccount[],
  today: string,
): OverviewModel {
  const included = performance.filter((p) =>
    model.accounts.some((a) => a.id === p.id),
  );
  const historyByCurrency: NonNullable<OverviewModel["historyByCurrency"]> = {};
  const available = included.filter(
    (p) =>
      p.history.status === "ok" &&
      p.history.data.points.some((point) => point.date <= today),
  );
  for (const group of aggregateHistory(available)) {
    if (group.currency !== "CAD" && group.currency !== "USD") continue;
    const points = group.points.filter((p) => p.date <= today);
    const latest = points.at(-1),
      previous = points.at(-2);
    const change = historyChange(points.slice(-2));
    const returns = latest
      ? cashFlowReturns(
          points[0],
          latest,
          group.currency,
          aggregateFunding(available, group.currency),
        )
      : null;
    const weekStart = new Date(`${today}T00:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
    const week = weekStart.toISOString().slice(0, 10);
    const ranges = Object.fromEntries(
      (["1D", "1W", "1M", "1Y", "All"] as OverviewRange[]).map((range) => {
        const selected =
          range === "All"
            ? points
            : range === "1W"
              ? points.filter((p) => p.date >= week)
              : selectHistoryRange(
                  points,
                  range === "1Y" ? "1 Year" : range,
                  today,
                );
        return [
          range,
          selected.map((p) => ({ label: p.date, value: p.value })),
        ];
      }),
    ) as OverviewHistory["ranges"];
    historyByCurrency[group.currency] = {
      ranges,
      dayChange:
        change.amount === null
          ? null
          : { amount: change.amount, percent: change.percent },
      gain:
        latest &&
        returns?.netGain.percent != null &&
        returns.netDeposits !== null
          ? {
              amount: latest.value - returns.netDeposits,
              percent: returns.netGain.percent,
            }
          : null,
      gainMessage:
        returns?.netGain.reason ||
        (latest ? null : "No shared dated snapshots are available."),
      period: latest && previous ? `${previous.date} → ${latest.date}` : null,
      asOf: latest?.date || null,
      accountCount: group.accountCount,
      totalAccounts: model.accounts.length,
      missingDates: group.missingDates,
    };
  }
  const errors = included.flatMap((p) =>
    p.history.status === "error"
      ? [p.history.message]
      : !available.includes(p)
        ? ["An account returned no dated historical snapshots."]
        : !["CAD", "USD"].includes(p.history.data.currency)
          ? ["Some account history uses an unsupported display currency."]
          : [],
  );
  return {
    ...model,
    historyByCurrency,
    historyIssues: [...new Set(errors)],
    historyReads: included.flatMap((a) => {
      const data =
        a.funding?.status === "ok" ? a.funding.data : a.funding?.partialData;
      return data?.coverage ? [{ label: a.name, coverage: data.coverage }] : [];
    }),
    historyMessage: errors.length
      ? `${errors.length} account histories could not load. ${[...new Set(errors)].join(" ")}`
      : included.length
        ? "No shared snapshots are available in this currency or date range."
        : "No investing account histories are available.",
    accounts: model.accounts.map((a) => {
      const source = included.find((p) => p.id === a.id)?.history;
      if (source?.status !== "ok") return a;
      const points = source.data.points.filter((p) => p.date <= today);
      const latest = points.at(-1),
        previous = points.at(-2),
        change = historyChange(points.slice(-2));
      return {
        ...a,
        dayChange:
          change.amount === null
            ? null
            : { amount: change.amount, percent: change.percent },
        dayChangeCurrency: source.data.currency,
        dayChangePeriod:
          latest && previous ? `${previous.date} → ${latest.date}` : undefined,
      };
    }),
  };
}
