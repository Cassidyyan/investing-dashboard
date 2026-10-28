import type { AccountFunding, HistoryPoint, Result } from "@/lib/types";
import { historyDay, valueChange } from "@/lib/performance/presentation";
import { cashFlowReturns } from "@/lib/performance/cash-flow-returns";
import { StatCard } from "@/components/shared/StatCard";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { ChangeBadge } from "@/components/shared/ChangeBadge";
import { PerformanceChart } from "./PerformanceChart";
import { PerformanceStats } from "./PerformanceStats";
import { HistoryInspection } from "./HistoryInspection";
import styles from "./Performance.module.css";
export function PerformanceHero({
  points,
  currency,
  funding,
  missingDates,
  accountCount,
  omittedPoints = 0,
}: {
  points: HistoryPoint[];
  currency: string;
  funding: Result<AccountFunding>;
  missingDates: number;
  accountCount: number;
  omittedPoints?: number;
}) {
  return (
    <StatCard
      title="Historical performance"
      className={styles.hero}
      action={
        <InfoPopover label="Historical performance methodology">
          <p>
            Estimated daily account values include cash. Change in value
            includes deposits, withdrawals and transfers; it is not investment
            return. No historical FX conversion or missing-day interpolation is
            applied.
          </p>
          <p>
            1D uses the latest observed daily interval; 5D uses up to five
            observed intervals. Longer ranges use calendar dates. Five-year and
            intraday history are not supplied. Dashed segments connect
            observations separated by missing calendar days.
          </p>
          <p>
            The history source is beta: values can have gaps and its schema may
            change. The current value is the latest observed snapshot in this
            range, not a live balance.
          </p>
          <p>
            Funding estimates use the existing recorded-net-deposit and Modified
            Dietz calculations with end-of-day flows. They may omit older
            funding and are not annualized or verified brokerage returns.
          </p>
        </InfoPopover>
      }
    >
      <p className={styles.caption}>
        {currency} · {accountCount}{" "}
        {accountCount === 1 ? "account" : "accounts"} · Latest observed value
      </p>
      <p className={styles.heroValue}>
        <MoneyValue amount={points.at(-1)?.value ?? null} currency={currency} />
      </p>
      <div className={styles.heroChange}>
        <span>Change in value</span>
        <ChangeBadge
          className={styles.changeBadge}
          change={valueChange(points)}
          currency={currency}
          showPercentWhenHidden
        />
        <span>since {historyDay(points[0].date)}</span>
        <InfoPopover label="What change in value includes">
          <p>
            Includes deposits, withdrawals and transfers; not an investment
            return.
          </p>
        </InfoPopover>
      </div>
      {missingDates > 0 && (
        <p className={styles.partial} role="status">
          Partial dates · {missingDates} dates excluded because included
          accounts do not all have snapshots.
        </p>
      )}
      {points.some(
        (p, i) =>
          i > 0 &&
          Date.parse(p.date) - Date.parse(points[i - 1].date) > 86400000,
      ) && (
        <p className={styles.partial}>
          Gaps between observations · dashed lines
        </p>
      )}
      {omittedPoints > 0 && (
        <p className={styles.partial}>
          {omittedPoints} invalid snapshots omitted.
        </p>
      )}
      <PerformanceChart points={points} currency={currency} funding={funding} />
      <PerformanceStats points={points} currency={currency} />
      <details className={styles.fundingDetails}>
        <summary>Funding-based return estimates</summary>
        <HistoryInspection
          inspection={cashFlowReturns(
            points[0],
            points.at(-1)!,
            currency,
            funding,
          )}
          currency={currency}
          dateLabel={historyDay(points.at(-1)!.date)}
          startLabel={historyDay(points[0].date)}
        />
      </details>
    </StatCard>
  );
}
