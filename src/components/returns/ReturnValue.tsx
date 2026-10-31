import { ChangeBadge } from "@/components/shared/ChangeBadge";
import { signedPercent } from "@/lib/format";
import styles from "./Returns.module.css";
import { Money } from "@/components/shared/Money";
export function ReturnAmount({
  value,
  currency,
  percent,
  showCurrency = false,
}: {
  value: number | null;
  currency: string;
  percent?: number | null;
  showCurrency?: boolean;
}) {
  if (value === null || value === 0)
    return (
      <span className={styles.inlineReturn}>
        <Money
          value={{ amount: value, currency }}
          zeroAsDash
          missingAsDash
          signed
          showCurrency={showCurrency}
        />
        {value === 0 && percent != null && percent !== 0 ? (
          <span> ({signedPercent(percent)})</span>
        ) : null}
      </span>
    );
  return (
    <ChangeBadge
      className={styles.changeBadge}
      change={{ amount: value, percent }}
      currency={currency}
      showCurrency={showCurrency}
      showPercentWhenHidden
    />
  );
}
export function ReturnPercent({ value }: { value: number | null }) {
  if (value === null || value === 0)
    return (
      <span
        aria-label={value === 0 ? "Zero percent" : "Percentage unavailable"}
      >
        —
      </span>
    );
  return (
    <span className={value > 0 ? styles.gain : styles.loss}>
      <span aria-hidden="true">{value > 0 ? "↑ " : "↓ "}</span>
      {signedPercent(value)}
    </span>
  );
}
