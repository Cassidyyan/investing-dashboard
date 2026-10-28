import type { AccountFunding, HistoryPoint, Result } from "@/lib/types";
import { cashFlowReturns } from "@/lib/performance/cash-flow-returns";
import { historyDay, valueChange } from "@/lib/performance/presentation";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { ChangeBadge } from "@/components/shared/ChangeBadge";
import { HistoryInspection } from "./HistoryInspection";
import styles from "./Performance.module.css";
export function ChartTooltip({
  points,
  index,
  currency,
  funding,
}: {
  points: HistoryPoint[];
  index: number;
  currency: string;
  funding: Result<AccountFunding>;
}) {
  const point = points[index];
  return (
    <div className={styles.tooltipContent}>
      <strong>{historyDay(point.date)}</strong>
      <p className={styles.tooltipValue}>
        <MoneyValue amount={point.value} currency={currency} />
      </p>
      <span>Change from previous observation</span>
      <div>
        <ChangeBadge
          className={styles.changeBadge}
          change={
            index ? valueChange(points.slice(index - 1, index + 1)) : null
          }
          currency={currency}
          showPercentWhenHidden
        />
      </div>
      {!index && <small>No earlier observation in this range.</small>}
      <HistoryInspection
        inspection={cashFlowReturns(points[0], point, currency, funding)}
        currency={currency}
        dateLabel={historyDay(point.date)}
        startLabel={historyDay(points[0].date)}
        compact
      />
    </div>
  );
}
