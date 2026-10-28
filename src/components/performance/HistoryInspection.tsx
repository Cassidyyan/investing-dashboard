import type { cashFlowReturns } from "@/lib/performance/cash-flow-returns";
import { money, signedPercent } from "@/lib/format";
import { PrivateValue } from "@/components/shared/BalancePrivacy";
import styles from "./Performance.module.css";

export function HistoryInspection({
  inspection,
  currency,
  dateLabel,
  startLabel,
  compact = false,
}: {
  inspection: ReturnType<typeof cashFlowReturns>;
  currency: string;
  dateLabel: string;
  startLabel: string;
  compact?: boolean;
}) {
  return (
    <div className={styles.inspection}>
      <p className={styles.inspectionDate}>{dateLabel} · Estimated returns</p>
      <dl className={styles.returnMetrics}>
        {!compact && (
          <div>
            <dt>Net deposits to this date</dt>
            <dd>
              <PrivateValue placeholder="••••">
                {money({ amount: inspection.netDeposits, currency })}
              </PrivateValue>
            </dd>
          </div>
        )}
        {(
          [
            ["Gain vs net deposits", inspection.netGain],
            ["Range return · cash-flow adjusted", inspection.period],
          ] as const
        ).map(([label, result]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd
              className={
                result.percent === null
                  ? styles.returnUnavailable
                  : result.percent < 0
                    ? styles.loss
                    : result.percent > 0
                      ? styles.gain
                      : undefined
              }
            >
              {signedPercent(result.percent)}
            </dd>
            {!compact && result.reason && (
              <p className={styles.returnReason}>{result.reason}</p>
            )}
          </div>
        ))}
      </dl>
      {!compact && (
        <p className={styles.returnReason}>
          Range starts {startLabel}. Move over the line or use the arrow keys to
          inspect a snapshot.
        </p>
      )}
    </div>
  );
}
