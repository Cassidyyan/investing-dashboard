import {
  absoluteDecimal,
  addDecimal,
  compareDecimal,
  decimal,
  divideDecimal,
  multiplyDecimal,
  type Decimal,
} from "@/lib/financial/decimal";
import type {
  AnalyticsTrade,
  OptionsFilters,
  OptionsLedger,
} from "./analytics-types";
const zero = decimal("0")!;
const sum = (rows: Decimal[]) => rows.reduce(addDecimal, zero);
const inRange = (day: string, filters: OptionsFilters) =>
  (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
const percent = (numerator: number, denominator: number) =>
  denominator ? (numerator / denominator) * 100 : null;
export function optionsAnalytics(
  ledger: OptionsLedger,
  filters: OptionsFilters,
) {
  const scoped = ledger.trades.filter(
    (t) =>
      (filters.account === "all" || t.accountId === filters.account) &&
      (filters.ticker === "all" || t.ticker === filters.ticker) &&
      (filters.right === "all" || t.contract?.type.value === filters.right) &&
      (filters.status === "all" || t.status === filters.status),
  );
  const trades = scoped.filter((t) => t.currency === filters.currency);
  const journal = scoped.filter(
    (t) =>
      (t.currency === filters.currency || t.currency === null) &&
      (t.realizations.some((r) => inRange(r.date, filters)) ||
        t.executions.some((e) => inRange(e.tradeDate, filters)) ||
        (!!t.observedOn && inRange(t.observedOn, filters))),
  );
  const realized = trades.flatMap((t) =>
    t.realizations
      .filter((r) => inRange(r.date, filters))
      .map((r) => ({ ...r, tradeId: t.id, ticker: t.ticker })),
  );
  const completed = trades.filter(
    (t) =>
      t.status === "closed" &&
      t.closedOn &&
      inRange(t.closedOn, filters) &&
      t.realizedPnl !== null,
  );
  const winners = completed.filter((t) => t.outcome === "win"),
    losers = completed.filter((t) => t.outcome === "loss"),
    breakeven = completed.filter((t) => t.outcome === "breakeven");
  const grossProfit = sum(winners.map((t) => t.realizedPnl!)),
    grossLoss = absoluteDecimal(sum(losers.map((t) => t.realizedPnl!)));
  const mean = (rows: AnalyticsTrade[]) =>
    rows.length
      ? divideDecimal(
          sum(rows.map((t) => t.realizedPnl!)),
          decimal(rows.length)!,
        )
      : null;
  const sorted = [...completed].sort((a, b) =>
    compareDecimal(a.realizedPnl!, b.realizedPnl!),
  );
  const cash = trades.flatMap((t) =>
    t.executions
      .filter(
        (e) =>
          e.kind === "trade" &&
          e.cash.premium !== null &&
          inRange(e.tradeDate, filters),
      )
      .map((e) => ({ ...e, ticker: t.ticker })),
  );
  const premiumReceived = sum(
    cash
      .filter((e) => compareDecimal(e.cash.premium!, zero) > 0)
      .map((e) => e.cash.premium!),
  );
  const premiumPaid = absoluteDecimal(
    sum(
      cash
        .filter((e) => compareDecimal(e.cash.premium!, zero) < 0)
        .map((e) => e.cash.premium!),
    ),
  );
  const openingCredits = sum(
    cash.filter((e) => e.action === "SELL_TO_OPEN").map((e) => e.cash.premium!),
  );
  const closingCredits = sum(
    cash
      .filter((e) => e.action === "SELL_TO_CLOSE")
      .map((e) => e.cash.premium!),
  );
  const days = new Map<string, Decimal>();
  for (const r of realized)
    days.set(r.date, addDecimal(days.get(r.date) || zero, r.pnl));
  let cumulative = zero;
  const series = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => {
      cumulative = addDecimal(cumulative, pnl);
      return { date, pnl, cumulative };
    });
  const months = [
    ...new Set([
      ...realized.map((r) => r.date.slice(0, 7)),
      ...completed.map((t) => t.closedOn!.slice(0, 7)),
      ...cash.map((e) => e.tradeDate.slice(0, 7)),
    ]),
  ]
    .sort()
    .map((month) => {
      const monthlyTrades = completed.filter((t) =>
        t.closedOn!.startsWith(month),
      );
      const monthlyCash = cash.filter((e) => e.tradeDate.startsWith(month));
      return {
        month,
        pnl: sum(
          realized.filter((r) => r.date.startsWith(month)).map((r) => r.pnl),
        ),
        realizedCount: realized.filter((r) => r.date.startsWith(month)).length,
        completed: monthlyTrades.length,
        winRate: percent(
          monthlyTrades.filter((t) => t.outcome === "win").length,
          monthlyTrades.length,
        ),
        received: sum(
          monthlyCash
            .filter((e) => compareDecimal(e.cash.premium!, zero) > 0)
            .map((e) => e.cash.premium!),
        ),
        paid: absoluteDecimal(
          sum(
            monthlyCash
              .filter((e) => compareDecimal(e.cash.premium!, zero) < 0)
              .map((e) => e.cash.premium!),
          ),
        ),
        cashCount: monthlyCash.length,
      };
    });
  const underlyings = [
    ...new Set([
      ...realized.map((r) => r.ticker),
      ...completed.map((t) => t.ticker),
      ...cash.map((e) => e.ticker),
    ]),
  ]
    .map((ticker) => {
      const closed = completed.filter((t) => t.ticker === ticker),
        events = realized.filter((r) => r.ticker === ticker);
      return {
        ticker,
        pnl: events.length ? sum(events.map((r) => r.pnl)) : null,
        completed: closed.length,
        winRate: percent(
          closed.filter((t) => t.outcome === "win").length,
          closed.length,
        ),
        average: mean(closed),
        premium: cash.some((e) => e.ticker === ticker)
          ? sum(
              cash
                .filter(
                  (e) =>
                    e.ticker === ticker &&
                    compareDecimal(e.cash.premium!, zero) > 0,
                )
                .map((e) => e.cash.premium!),
            )
          : null,
      };
    })
    .sort((a, b) =>
      a.pnl === null ? 1 : b.pnl === null ? -1 : -compareDecimal(a.pnl, b.pnl),
    );
  let monthlyCumulative = zero;
  const monthlySeries = months
    .filter((m) => m.realizedCount > 0)
    .map((m) => {
      monthlyCumulative = addDecimal(monthlyCumulative, m.pnl);
      return {
        date: `${m.month}-01`,
        pnl: m.pnl,
        cumulative: monthlyCumulative,
      };
    });
  return {
    journal,
    realized,
    completed,
    winners: winners.length,
    losers: losers.length,
    breakeven: breakeven.length,
    winRate: percent(winners.length, completed.length),
    pnl: realized.length ? sum(realized.map((r) => r.pnl)) : null,
    averageWin: mean(winners),
    averageLoss: mean(losers),
    profitFactor:
      grossLoss === zero
        ? grossProfit === zero
          ? { status: "undefined" as const, value: null }
          : { status: "infinite" as const, value: null }
        : {
            status: "finite" as const,
            value: divideDecimal(grossProfit, grossLoss),
          },
    best: sorted.filter((t) => t.outcome === "win").at(-1) || null,
    worst: sorted.find((t) => t.outcome === "loss") || null,
    premiumReceived: cash.length ? premiumReceived : null,
    premiumPaid: cash.length ? premiumPaid : null,
    netPremium: cash.length
      ? addDecimal(
          premiumReceived,
          multiplyDecimal(premiumPaid, decimal("-1")!),
        )
      : null,
    openingCredits: cash.length ? openingCredits : null,
    closingCredits: cash.length ? closingCredits : null,
    series,
    monthlySeries,
    months,
    underlyings,
    excluded: scoped.filter((t) => t.status === "needs-review").length,
    missingCash: trades
      .flatMap((t) => t.executions)
      .filter((e) => e.cash.premium === null && inRange(e.tradeDate, filters))
      .length,
    otherCurrencies: [
      ...new Set(
        scoped
          .map((t) => t.currency)
          .filter((c) => c && c !== "USD" && c !== "CAD"),
      ),
    ],
  };
}
export type OptionsAnalytics = ReturnType<typeof optionsAnalytics>;
