import { useState } from "react";
import type { AllocationItem } from "@/lib/holdings/holdings-view";
import { useBalancePrivacy } from "@/components/shared/BalancePrivacy";
import { MoneyValue } from "@/components/shared/MoneyValue";
import shared from "@/styles/dashboard.module.css";
import styles from "./Holdings.module.css";
export function AllocationBars({
  items,
  currency,
}: {
  items: AllocationItem[];
  currency: string;
}) {
  const [expanded, setExpanded] = useState(false),
    { hidden } = useBalancePrivacy();
  const rows = expanded ? items : items.slice(0, 6);
  return (
    <>
      <ol
        className={`${styles.allocationList} ${expanded ? styles.expandedList : ""}`}
        aria-label="Ranked allocation values and percentages"
      >
        {rows.map((item) => (
          <li key={item.key}>
            <div className={styles.allocationLine}>
              <i style={{ background: item.color }} aria-hidden="true" />
              <span className={styles.allocationName} title={item.label}>
                {item.label}
              </span>
              <span>{item.percent.toFixed(1)}%</span>
              <b>
                <MoneyValue amount={item.amount} currency={currency} />
              </b>
            </div>
            <div
              className={`${styles.track} ${hidden ? shared.blurred : ""}`}
              aria-hidden="true"
            >
              <span
                style={{ width: `${item.percent}%`, background: item.color }}
              />
            </div>
          </li>
        ))}
      </ol>
      {items.length > 6 && (
        <button
          type="button"
          className={styles.textButton}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show top 6" : `Show all (${items.length})`}
        </button>
      )}
    </>
  );
}
