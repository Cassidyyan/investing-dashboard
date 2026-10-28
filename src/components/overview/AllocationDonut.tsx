import { useId } from "react";
import {
  PrivateValue,
  useBalancePrivacy,
} from "@/components/shared/BalancePrivacy";
import { StatCard } from "./StatCard";
import styles from "./Overview.module.css";
export function AllocationDonut({
  rows,
  partial,
}: {
  rows: { label: string; percent: number }[];
  partial: boolean;
}) {
  const { hidden } = useBalancePrivacy();
  const id = useId();
  return (
    <StatCard title="Asset allocation" className={styles.third}>
      {rows.length ? (
        <>
          <div className={styles.donutWrap}>
            <svg
              viewBox="0 0 160 160"
              className={hidden ? styles.blurred : ""}
              role="img"
              aria-hidden={hidden || undefined}
              aria-labelledby={id}
            >
              <title id={id}>
                Positive investing assets by class; percentages listed below.
              </title>
              <circle
                cx="80"
                cy="80"
                r="56"
                fill="none"
                stroke="var(--ov-border)"
                strokeWidth="22"
              />
              {rows.map((r, i) => {
                const offset = rows
                  .slice(0, i)
                  .reduce((sum, row) => sum + row.percent, 0);
                return (
                  <circle
                    key={r.label}
                    cx="80"
                    cy="80"
                    r="56"
                    pathLength="100"
                    fill="none"
                    stroke={`var(--ov-chart-${i % 6})`}
                    strokeWidth="22"
                    strokeDasharray={`${r.percent} ${100 - r.percent}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 80 80)"
                  >
                    <title>
                      {hidden
                        ? r.label
                        : `${r.label}: ${r.percent.toFixed(1)}%`}
                    </title>
                  </circle>
                );
              })}
            </svg>
            {hidden && (
              <span className={styles.chartOverlay}>Chart hidden</span>
            )}
          </div>
          <ul className={styles.legend} aria-label="Allocation percentages">
            {rows.map((r, i) => (
              <li key={r.label}>
                <span>
                  <i
                    style={{ background: `var(--ov-chart-${i % 6})` }}
                    aria-hidden="true"
                  />
                  {r.label}
                </span>
                <b>
                  <PrivateValue placeholder="••••">
                    {r.percent.toFixed(1)}%
                  </PrivateValue>
                </b>
              </li>
            ))}
          </ul>
          <p className={styles.footnote}>
            {partial ? "Partial allocation. " : ""}Positive cash and positions
            only; excludes shorts and unavailable valuations.
          </p>
        </>
      ) : (
        <p className={styles.empty}>
          No valued assets available for allocation.
        </p>
      )}
    </StatCard>
  );
}
