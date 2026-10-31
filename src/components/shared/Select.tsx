"use client";
import type { ComponentProps } from "react";
import styles from "./Controls.module.css";
// Native keyboard, touch and screen-reader behavior with shared visual chrome.
export function Select({
  className = "",
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <span className={styles.selectWrap}>
      <select {...props} className={`${styles.select} ${className}`}>
        {children}
      </select>
      <span className={styles.caret} aria-hidden="true">
        ⌄
      </span>
    </span>
  );
}
export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={styles.switch}
    >
      <span className={styles.switchTrack} aria-hidden="true">
        <span />
      </span>
      {label}
    </button>
  );
}
export function SortDirectionButton({
  direction,
  onChange,
}: {
  direction: "ascending" | "descending";
  onChange: (value: "ascending" | "descending") => void;
}) {
  const label =
    direction === "descending" ? "Highest to lowest" : "Lowest to highest";
  return (
    <button
      type="button"
      className={styles.direction}
      aria-label={`Sort direction: ${label}`}
      title={`${label}. Reverse sort direction`}
      onClick={() =>
        onChange(direction === "descending" ? "ascending" : "descending")
      }
    >
      <span aria-hidden="true">{direction === "descending" ? "↓" : "↑"}</span>
    </button>
  );
}
