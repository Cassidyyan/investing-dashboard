import { useBalancePrivacy } from "@/components/shared/BalancePrivacy";
import shared from "@/styles/dashboard.module.css";
import styles from "./Returns.module.css";
export type ProfitPart = { label: string; value: number };
export function ProfitBar({
  value = 0,
  max = 0,
  parts,
}: {
  value?: number;
  max?: number;
  parts?: ProfitPart[];
}) {
  const { hidden } = useBalancePrivacy();
  const items = parts || [{ label: "Total profit", value }];
  const positive = items.filter((p) => p.value > 0),
    negative = items.filter((p) => p.value < 0);
  const bound = parts
    ? Math.max(
        positive.reduce((s, p) => s + p.value, 0),
        negative.reduce((s, p) => s - p.value, 0),
      )
    : max;
  return (
    <div
      className={`${styles.profitBar} ${hidden ? shared.blurred : ""}`}
      aria-hidden="true"
    >
      <div className={styles.negativeHalf}>
        {negative.map((p, i) => (
          <span
            key={`${p.label}-${i}`}
            style={{
              width: `${bound > 0 ? Math.min(100, (-p.value / bound) * 100) : 0}%`,
            }}
          />
        ))}
      </div>
      <div className={styles.positiveHalf}>
        {positive.map((p, i) => (
          <span
            key={`${p.label}-${i}`}
            style={{
              width: `${bound > 0 ? Math.min(100, (p.value / bound) * 100) : 0}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
