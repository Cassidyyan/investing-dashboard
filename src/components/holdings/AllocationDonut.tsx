import { useId } from "react";
import type { AllocationItem } from "@/lib/holdings/holdings-view";
import { useBalancePrivacy } from "@/components/shared/BalancePrivacy";
import { MoneyValue } from "@/components/shared/MoneyValue";
import shared from "@/styles/dashboard.module.css";
import styles from "./Holdings.module.css";
export function AllocationDonut({
  items,
  total,
  currency,
}: {
  items: AllocationItem[];
  total: number | null;
  currency: string;
}) {
  const { hidden } = useBalancePrivacy(),
    id = useId();
  return (
    <div className={styles.donut}>
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-labelledby={id}
        aria-hidden={hidden || undefined}
        className={hidden ? shared.blurred : undefined}
      >
        <title id={id}>
          Allocation of estimated positive holdings value. Real items and
          percentages are listed below.
        </title>
        <circle
          cx="100"
          cy="100"
          r="78"
          fill="none"
          stroke="var(--ov-border)"
          strokeWidth="22"
        />
        {items.map((item, i) => {
          const offset = items
            .slice(0, i)
            .reduce((sum, r) => sum + r.percent, 0);
          return (
            <circle
              key={item.key}
              cx="100"
              cy="100"
              r="78"
              pathLength="100"
              fill="none"
              stroke={item.color}
              strokeWidth="22"
              strokeDasharray={`${item.percent} ${100 - item.percent}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 100 100)"
            >
              <title>{`${item.label}: ${item.percent.toFixed(1)}%`}</title>
            </circle>
          );
        })}
      </svg>
      <div className={styles.donutCenter}>
        <strong>
          <MoneyValue amount={total} currency={currency} />
        </strong>
        <span>{hidden ? "Chart hidden" : "Estimated holdings value"}</span>
      </div>
    </div>
  );
}
