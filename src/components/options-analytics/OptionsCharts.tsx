"use client";
import { useState } from "react";
import { StatCard } from "@/components/shared/StatCard";
import { Money } from "@/components/shared/Money";
import { useBalancePrivacy } from "@/components/shared/BalancePrivacy";
import { decimalNumber, subtractDecimal } from "@/lib/financial/decimal";
import type { OptionsAnalytics } from "@/lib/options/analytics";
import styles from "./OptionsAnalytics.module.css";
function Value({
  value,
  currency,
}: {
  value: Parameters<typeof decimalNumber>[0];
  currency: string;
}) {
  return <Money value={{ amount: decimalNumber(value), currency }} signed />;
}
export function OptionsCharts({
  stats,
  currency,
}: {
  stats: OptionsAnalytics;
  currency: string;
}) {
  const [active, setActive] = useState<number | null>(null),
    [granularity, setGranularity] = useState("daily");
  const { hidden } = useBalancePrivacy();
  const points = granularity === "daily" ? stats.series : stats.monthlySeries;
  const values = points.map((p) => decimalNumber(p.cumulative) ?? 0),
    min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    span = max - min || 1;
  const times = points.map((p) => Date.parse(p.date));
  const duration = times.length > 1 ? times[times.length - 1] - times[0] : 0;
  const xy = (i: number) => ({
    x: 24 + (duration ? (times[i] - times[0]) / duration : 0.5) * 712,
    y: 200 - ((values[i] - min) / span) * 170,
  });
  const inspect = (clientX: number, node: SVGSVGElement) => {
    const rect = node.getBoundingClientRect(),
      x = ((clientX - rect.left) / rect.width) * 760;
    let index = 0;
    for (let i = 1; i < points.length; i++)
      if (Math.abs(xy(i).x - x) < Math.abs(xy(index).x - x)) index = i;
    setActive(index);
  };
  const selected =
    points[
      active !== null && active < points.length
        ? active
        : Math.max(0, points.length - 1)
    ];
  const monthlyMax = Math.max(
    1,
    ...stats.months.map((m) => Math.abs(decimalNumber(m.pnl) ?? 0)),
  );
  const premiumMax = Math.max(
    1,
    ...stats.months.flatMap((m) => [
      decimalNumber(m.received) ?? 0,
      decimalNumber(m.paid) ?? 0,
    ]),
  );
  return (
    <div className={styles.charts}>
      <StatCard
        title="Cumulative realized P&L"
        action={
          <label className={styles.inlineLabel}>
            Aggregation
            <select
              value={granularity}
              onChange={(e) => {
                setGranularity(e.target.value);
                setActive(null);
              }}
            >
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        }
      >
        <p>
          Starts at zero for the selected range. Observed realization dates
          only; no interpolated daily returns.
        </p>
        {!points.length ? (
          <p className={styles.empty}>
            No evaluable realized quantities in this range.
          </p>
        ) : (
          <>
            {hidden ? (
              <div
                className={styles.hiddenChart}
                role="img"
                aria-label="Realized P&L chart hidden"
              >
                •••• · Chart hidden
              </div>
            ) : (
              <svg
                viewBox="0 0 760 230"
                className={styles.lineChart}
                role="img"
                aria-label="Cumulative realized P&L; use the observation selector below for exact values"
                onPointerMove={(event) =>
                  inspect(event.clientX, event.currentTarget)
                }
                onPointerDown={(event) =>
                  inspect(event.clientX, event.currentTarget)
                }
              >
                <line
                  x1="24"
                  x2="736"
                  y1={200 - ((0 - min) / span) * 170}
                  y2={200 - ((0 - min) / span) * 170}
                  stroke="var(--ov-border)"
                />
                <polyline
                  points={points
                    .map((_, i) => `${xy(i).x},${xy(i).y}`)
                    .join(" ")}
                  fill="none"
                  stroke="var(--ov-brand)"
                  strokeWidth="3"
                />
                {points.map((p, i) => (
                  <circle
                    key={p.date}
                    cx={xy(i).x}
                    cy={xy(i).y}
                    r={i === active ? 7 : 5}
                    fill="var(--ov-brand)"
                    aria-hidden="true"
                  />
                ))}
              </svg>
            )}
            <label className={styles.inlineLabel}>
              Inspect realization
              <select
                aria-label="Inspect options realization date"
                value={selected?.date || ""}
                onChange={(event) =>
                  setActive(
                    points.findIndex((p) => p.date === event.target.value),
                  )
                }
              >
                {points.map((p) => (
                  <option key={p.date} value={p.date}>
                    {p.date}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <div className={styles.inspection} aria-live="polite">
                <span>{selected.date}</span>
                <strong>
                  <Value value={selected.cumulative} currency={currency} />
                </strong>
                <span>
                  Realized this {granularity === "daily" ? "day" : "month"}:{" "}
                  <Value value={selected.pnl} currency={currency} />
                </span>
              </div>
            )}
            <details className={styles.dataTable}>
              <summary>View realized P&L data</summary>
              <ul tabIndex={0}>
                {points.map((p) => (
                  <li key={p.date}>
                    <span>{p.date}</span>
                    <Value value={p.pnl} currency={currency} />
                    <span>
                      Cumulative{" "}
                      <Value value={p.cumulative} currency={currency} />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </StatCard>
      <StatCard title="Monthly options P&L">
        <p>
          Partial realizations count in P&L. Trade counts and win rates use
          final lifecycle closes.
        </p>
        {!stats.months.some((m) => m.realizedCount) ? (
          <p className={styles.empty}>No supported monthly realizations yet.</p>
        ) : (
          <ul className={styles.barList} tabIndex={0}>
            {stats.months
              .filter((m) => m.realizedCount)
              .map((m) => (
                <li key={m.month}>
                  <div>
                    <strong>{m.month}</strong>
                    <Value value={m.pnl} currency={currency} />
                  </div>
                  {!hidden && (
                    <div className={styles.track} aria-hidden="true">
                      <span
                        style={{
                          width: `${(Math.abs(decimalNumber(m.pnl) ?? 0) / monthlyMax) * 100}%`,
                          background:
                            Number(m.pnl) < 0
                              ? "var(--ov-negative)"
                              : Number(m.pnl) > 0
                                ? "var(--ov-positive)"
                                : "var(--ov-neutral)",
                        }}
                      />
                    </div>
                  )}
                  <small>
                    {Number(m.pnl) > 0
                      ? "Gain"
                      : Number(m.pnl) < 0
                        ? "Loss"
                        : "Breakeven"}{" "}
                    · {m.completed} completed ·{" "}
                    {m.winRate === null
                      ? "Win rate unavailable"
                      : `${m.winRate.toFixed(1)}% wins`}
                  </small>
                </li>
              ))}
          </ul>
        )}
      </StatCard>
      <StatCard title="Premium cash flow">
        <p>
          Gross credits and debits by transaction month, before fees. Includes
          open exposure; this is not profit.
        </p>
        {!stats.months.some((m) => m.cashCount) ? (
          <p className={styles.empty}>No evaluable premium cash flows.</p>
        ) : (
          <ul className={styles.barList} tabIndex={0}>
            {stats.months
              .filter((m) => m.cashCount)
              .map((m) => (
                <li key={m.month}>
                  <strong>{m.month}</strong>
                  <div>
                    <span>Received</span>
                    <Value value={m.received} currency={currency} />
                  </div>
                  {!hidden && (
                    <div className={styles.track} aria-hidden="true">
                      <span
                        style={{
                          width: `${((decimalNumber(m.received) ?? 0) / premiumMax) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <span>Paid</span>
                    <Value value={m.paid} currency={currency} />
                  </div>
                  {!hidden && (
                    <div className={styles.track} aria-hidden="true">
                      <span
                        style={{
                          width: `${((decimalNumber(m.paid) ?? 0) / premiumMax) * 100}%`,
                          background: "var(--ov-neutral)",
                        }}
                      />
                    </div>
                  )}
                  <small>
                    Net{" "}
                    <Value
                      value={subtractDecimal(m.received, m.paid)}
                      currency={currency}
                    />
                  </small>
                </li>
              ))}
          </ul>
        )}
      </StatCard>
      <StatCard title="Winning vs losing trades">
        <p>
          Completed, reconciled lifecycles only. Breakeven is included in the
          win-rate denominator.
        </p>
        <ul className={styles.outcomes}>
          <li>
            <strong>{stats.winners}</strong>
            <span>Winning trades</span>
          </li>
          <li>
            <strong>{stats.losers}</strong>
            <span>Losing trades</span>
          </li>
          <li>
            <strong>{stats.breakeven}</strong>
            <span>Breakeven trades</span>
          </li>
        </ul>
        <dl className={styles.metrics}>
          <div>
            <dt>Average win</dt>
            <dd>
              <Value value={stats.averageWin} currency={currency} />
            </dd>
          </div>
          <div>
            <dt>Average loss</dt>
            <dd>
              <Value value={stats.averageLoss} currency={currency} />
            </dd>
          </div>
        </dl>
      </StatCard>
    </div>
  );
}
