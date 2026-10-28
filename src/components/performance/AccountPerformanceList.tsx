import type { PerformanceAccount, Portfolio } from "@/lib/types";
import {
  selectHistoryRange,
  type HistoryRange,
} from "@/lib/performance/performance";
import { chartGeometry, valueChange } from "@/lib/performance/presentation";
import { StatCard } from "@/components/shared/StatCard";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { ChangeBadge } from "@/components/shared/ChangeBadge";
import { useBalancePrivacy } from "@/components/shared/BalancePrivacy";
import { InfoPopover } from "@/components/shared/InfoPopover";
import shared from "@/styles/dashboard.module.css";
import styles from "./Performance.module.css";
export function AccountPerformanceList({
  accounts,
  portfolio,
  currency,
  range,
  today,
}: {
  accounts: PerformanceAccount[];
  portfolio?: Portfolio;
  currency: string;
  range: HistoryRange;
  today: string;
}) {
  const { hidden } = useBalancePrivacy();
  const rows = accounts
    .flatMap((a) =>
      a.history.status === "ok" && a.history.data.currency === currency
        ? [
            {
              a,
              points: selectHistoryRange(a.history.data.points, range, today),
            },
          ]
        : [],
    )
    .filter((r) => r.points.length);
  if (!rows.length) return null;
  return (
    <StatCard
      title="Account performance"
      action={
        <InfoPopover label="Account performance values">
          <p>
            Each row uses that account’s observed history in the selected
            currency and range. Changes include cash flows. Accounts with no
            snapshots in this selection are omitted, not counted as zero.
          </p>
        </InfoPopover>
      }
    >
      <div className={styles.accountRows}>
        {rows.map(({ a, points }, i) => {
          const source =
            portfolio?.accounts.status === "ok"
              ? portfolio.accounts.data.find((r) => r.account.id === a.id)
                  ?.account
              : null;
          const g = chartGeometry(points);
          return (
            <article className={styles.accountRow} key={a.id}>
              <div>
                <h3>{a.name}</h3>
                <div className={styles.accountMeta}>
                  {source?.type && (
                    <span className={styles.badge}>{source.type}</span>
                  )}
                  <span>{a.suffix}</span>
                </div>
              </div>
              <div>
                <span className={styles.fieldLabel}>Latest value</span>
                <strong>
                  <MoneyValue
                    amount={points.at(-1)!.value}
                    currency={currency}
                  />
                </strong>
              </div>
              <div>
                <span className={styles.fieldLabel}>Change in value</span>
                <ChangeBadge
                  className={styles.changeBadge}
                  change={valueChange(points)}
                  currency={currency}
                  showPercentWhenHidden
                />
              </div>
              <svg
                className={`${styles.sparkline} ${hidden ? shared.blurred : ""}`}
                viewBox="0 0 800 250"
                aria-hidden="true"
              >
                {points.length === 1 ? (
                  <circle
                    cx="420"
                    cy="124"
                    r="10"
                    fill={`var(--performance-chart-${i % 3})`}
                  />
                ) : (
                  g.segments.map((s, j) => (
                    <path
                      key={j}
                      d={s.path}
                      fill="none"
                      stroke={`var(--performance-chart-${i % 3})`}
                      strokeWidth="10"
                      strokeDasharray={s.gap ? "20 20" : undefined}
                    />
                  ))
                )}
              </svg>
            </article>
          );
        })}
      </div>
    </StatCard>
  );
}
