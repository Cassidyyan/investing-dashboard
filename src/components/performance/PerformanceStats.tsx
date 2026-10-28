import type { HistoryPoint } from "@/lib/types";
import { MoneyValue } from "@/components/shared/MoneyValue";
import styles from "./Performance.module.css";
export function PerformanceStats({
  points,
  currency,
}: {
  points: HistoryPoint[];
  currency: string;
}) {
  return (
    <dl className={styles.stats}>
      {[
        ["Start", points[0].value],
        ["Current", points.at(-1)!.value],
        ["High", Math.max(...points.map((p) => p.value))],
        ["Low", Math.min(...points.map((p) => p.value))],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            <MoneyValue amount={value as number} currency={currency} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
