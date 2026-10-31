"use client";
import { useState } from "react";
import { StatCard } from "@/components/shared/StatCard";
import { Money } from "@/components/shared/Money";
import { Select, SortDirectionButton } from "@/components/shared/Select";
import { decimalNumber, compareDecimal } from "@/lib/financial/decimal";
import type { OptionsAnalytics } from "@/lib/options/analytics";
import styles from "./OptionsAnalytics.module.css";
type Sort = "pnl" | "completed" | "winRate" | "average" | "premium";
export function UnderlyingPerformance({
  stats,
  currency,
  onSelect,
}: {
  stats: OptionsAnalytics;
  currency: string;
  onSelect: (ticker: string) => void;
}) {
  const [sort, setSort] = useState<Sort>("pnl"),
    [direction, setDirection] = useState<"ascending" | "descending">(
      "descending",
    );
  const rows = [...stats.underlyings].sort((a, b) => {
    const left = a[sort],
      right = b[sort];
    if (left === null)
      return right === null ? a.ticker.localeCompare(b.ticker) : 1;
    if (right === null) return -1;
    const cmp =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : compareDecimal(
            left as NonNullable<typeof a.pnl>,
            right as NonNullable<typeof a.pnl>,
          );
    return (
      (direction === "descending" ? -cmp : cmp) ||
      a.ticker.localeCompare(b.ticker)
    );
  });
  const amount = (n: Parameters<typeof decimalNumber>[0]) => (
    <Money value={{ amount: decimalNumber(n), currency }} signed />
  );
  return (
    <StatCard
      title="Performance by underlying"
      action={
        <div className={styles.controls}>
          <Select
            aria-label="Sort underlying performance"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="pnl">Realized P&L</option>
            <option value="completed">Completed trades</option>
            <option value="winRate">Win rate</option>
            <option value="average">Average P&L</option>
            <option value="premium">Premium collected</option>
          </Select>
          <SortDirectionButton direction={direction} onChange={setDirection} />
        </div>
      }
    >
      <p>
        Select a ticker to filter the entire dashboard. Average P&L uses
        completed lifecycles; total P&L also includes supported partial closes.
      </p>
      {!rows.length ? (
        <p className={styles.empty}>
          No evaluable underlying results match these filters.
        </p>
      ) : (
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            Underlying performance in {currency}, sorted by {sort}, {direction}
          </caption>
          <thead>
            <tr>
              {[
                "Underlying",
                "Realized P&L",
                "Completed",
                "Win rate",
                "Average P&L",
                "Premium collected",
              ].map((h) => (
                <th scope="col" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ticker}>
                <th scope="row">
                  <button
                    type="button"
                    onClick={() => onSelect(row.ticker)}
                    aria-label={`Filter options by ${row.ticker}`}
                  >
                    {row.ticker}
                  </button>
                </th>
                <td data-label="Realized P&L">{amount(row.pnl)}</td>
                <td data-label="Completed">{row.completed}</td>
                <td data-label="Win rate">
                  {row.winRate === null
                    ? "Unavailable"
                    : `${row.winRate.toFixed(1)}%`}
                </td>
                <td data-label="Average P&L">{amount(row.average)}</td>
                <td data-label="Premium collected">{amount(row.premium)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </StatCard>
  );
}
