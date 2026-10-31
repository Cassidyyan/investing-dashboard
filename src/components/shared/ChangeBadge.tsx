import { signedPercent } from "@/lib/format";
import { Money } from "./Money";
import styles from "@/styles/dashboard.module.css";
export function ChangeBadge({
  change,
  currency,
  className = "",
  showCurrency = true,
}: {
  change: { amount: number; percent?: number | null } | null;
  currency: string;
  showPercentWhenHidden?: boolean;
  className?: string;
  showCurrency?: boolean;
}) {
  if (!change) return <span className={styles.unavailable}>Unavailable</span>;
  return (
    <span
      className={`${styles.change} ${change.amount > 0 ? styles.positive : change.amount < 0 ? styles.negative : styles.neutral} ${className}`}
    >
      <span aria-hidden="true">
        {change.amount > 0 ? "↑" : change.amount < 0 ? "↓" : "→"}
      </span>
      <Money
        value={{ amount: change.amount, currency }}
        signed
        showCurrency={showCurrency}
      />
      {change.percent != null && <span>({signedPercent(change.percent)})</span>}
    </span>
  );
}
