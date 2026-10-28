import { signedMoney, signedPercent } from "@/lib/format";
import { PrivateValue } from "@/components/shared/BalancePrivacy";
import styles from "@/styles/dashboard.module.css";
export function ChangeBadge({
  change,
  currency,
  showPercentWhenHidden = false,
}: {
  change: { amount: number; percent?: number | null } | null;
  currency: string;
  showPercentWhenHidden?: boolean;
}) {
  if (!change) return <span className={styles.unavailable}>Unavailable</span>;
  return (
    <span
      className={`${styles.change} ${change.amount > 0 ? styles.positive : change.amount < 0 ? styles.negative : styles.neutral}`}
    >
      <span aria-hidden="true">
        {change.amount > 0 ? "↑" : change.amount < 0 ? "↓" : "→"}
      </span>
      <PrivateValue placeholder="••••">
        {signedMoney({ amount: change.amount, currency })}
        {!showPercentWhenHidden &&
          change.percent != null &&
          ` (${signedPercent(change.percent)})`}
      </PrivateValue>
      {showPercentWhenHidden && change.percent != null && (
        <span>({signedPercent(change.percent)})</span>
      )}
    </span>
  );
}
