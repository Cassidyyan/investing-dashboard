"use client";
import styles from "@/components/overview/Overview.module.css";
export type CurrencySelection = "CAD" | "USD" | "COMBINED_USD";
export function CurrencyToggle<T extends CurrencySelection>({
  value,
  onChange,
  label = "Display currency",
  includeCombined = false,
}: {
  value: T;
  onChange: (value: T) => void;
  label?: string;
  includeCombined?: boolean;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {(
        [
          "CAD",
          "USD",
          ...(includeCombined ? ["COMBINED_USD"] : []),
        ] as CurrencySelection[]
      ).map((currency) => (
        <button
          key={currency === "COMBINED_USD" ? "Combined est. USD" : currency}
          type="button"
          aria-pressed={value === currency}
          onClick={() => onChange(currency as T)}
        >
          {currency === "COMBINED_USD" ? "Combined est. USD" : currency}
        </button>
      ))}
    </div>
  );
}
