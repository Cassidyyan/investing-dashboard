import styles from "@/styles/dashboard.module.css";
export function RangeToggle<T extends string>({
  value,
  onChange,
  options,
  label = "Portfolio chart range",
}: {
  value: T;
  onChange: (value: T) => void;
  options?: readonly { value: T; label: string; disabledReason?: string }[];
  label?: string;
}) {
  return (
    <div className={styles.rangeToggle} role="group" aria-label={label}>
      {(
        options ||
        ["1D", "1W", "1M", "1Y", "All"].map((range) => ({
          value: range as T,
          label: range,
          disabledReason: undefined,
        }))
      ).map((range) => (
        <button
          key={range.value}
          type="button"
          aria-pressed={range.value === value}
          disabled={!!range.disabledReason}
          title={range.disabledReason}
          onClick={() => onChange(range.value)}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
