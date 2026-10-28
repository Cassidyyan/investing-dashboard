import type { OverviewRange } from "@/lib/overview";
import styles from "./Overview.module.css";
export function RangeToggle({
  value,
  onChange,
}: {
  value: OverviewRange;
  onChange: (value: OverviewRange) => void;
}) {
  return (
    <div
      className={styles.rangeToggle}
      role="group"
      aria-label="Portfolio chart range"
    >
      {(["1D", "1W", "1M", "1Y", "All"] as OverviewRange[]).map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={range === value}
          onClick={() => onChange(range)}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
