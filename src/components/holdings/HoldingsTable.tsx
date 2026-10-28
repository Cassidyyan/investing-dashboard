import type { AccountData, ExchangeRate, Result } from "@/lib/types";
import {
  selectedValue,
  type HoldingEntry,
  type HoldingsCurrency,
} from "@/lib/holdings/holdings-view";
import { HoldingRow } from "./HoldingRow";
import styles from "./Holdings.module.css";
export type HoldingsSort = {
  key: "holding" | "value" | "weight" | "account";
  direction: "ascending" | "descending";
};
export function sortHoldingEntries(
  entries: HoldingEntry[],
  sort: HoldingsSort,
  mode: HoldingsCurrency,
  rate: Result<ExchangeRate>,
) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const rawLeft =
        sort.key === "holding"
          ? a.entry.position.symbol
          : sort.key === "account"
            ? a.entry.account.name
            : selectedValue(a.entry.position, mode, rate);
      const rawRight =
        sort.key === "holding"
          ? b.entry.position.symbol
          : sort.key === "account"
            ? b.entry.account.name
            : selectedValue(b.entry.position, mode, rate);
      const left =
        sort.key === "weight" && typeof rawLeft === "number" && rawLeft <= 0
          ? null
          : rawLeft;
      const right =
        sort.key === "weight" && typeof rawRight === "number" && rawRight <= 0
          ? null
          : rawRight;
      if (left === null) return right === null ? a.index - b.index : 1;
      if (right === null) return -1;
      const comparison =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : (left as number) - (right as number);
      return (
        (sort.direction === "ascending" ? comparison : -comparison) ||
        a.index - b.index
      );
    })
    .map((r) => r.entry);
}
export function HoldingsTable({
  entries,
  group,
  sort,
  onSort,
  mode,
  rate,
  total,
  accounts,
}: {
  entries: HoldingEntry[];
  group: boolean;
  sort: HoldingsSort;
  onSort: (key: HoldingsSort["key"]) => void;
  mode: HoldingsCurrency;
  rate: Result<ExchangeRate>;
  total: number | null;
  accounts: AccountData[];
}) {
  if (!entries.length)
    return <p className={styles.empty}>No positions match these filters.</p>;
  const sorted = sortHoldingEntries(entries, sort, mode, rate);
  const groups = group
    ? [...new Set(sorted.map((e) => e.account.id))].map((id) => ({
        key: id,
        name: sorted.find((e) => e.account.id === id)!.account.name,
        rows: sorted.filter((e) => e.account.id === id),
      }))
    : [{ key: "all", name: "", rows: sorted }];
  return (
    <div className={styles.tables}>
      {groups.map((g) => (
        <section
          className={styles.accountSection}
          key={g.key}
          aria-label={g.name || "Positions"}
        >
          {group && (
            <h3>
              {g.name} <span>{g.rows.length} positions</span>
            </h3>
          )}
          <table className={styles.table} role="table">
            <caption className={styles.srOnly}>
              {g.name || "All selected accounts"} positions. Sorted by{" "}
              {sort.key}, {sort.direction}. Expand rows for native prices and
              quantities.
            </caption>
            <colgroup>
              <col className={styles.securityColumn} />
              <col className={styles.valueColumn} />
              <col className={styles.weightColumn} />
              <col className={styles.accountColumn} />
            </colgroup>
            <thead>
              <tr>
                {(
                  [
                    ["holding", "Holding"],
                    ["value", "Value"],
                    ["weight", "Weight"],
                    ["account", "Account"],
                  ] as const
                ).map(([key, label]) => (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={sort.key === key ? sort.direction : "none"}
                    className={
                      key === "value" || key === "weight"
                        ? styles.numeric
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSort(key)}
                      aria-label={`Sort ${label}`}
                    >
                      {label}
                      <span aria-hidden="true">
                        {sort.key === key
                          ? sort.direction === "descending"
                            ? "↓"
                            : "↑"
                          : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            {g.rows.map((entry) => (
              <HoldingRow
                key={entry.key}
                entry={entry}
                mode={mode}
                rate={rate}
                total={total}
                accounts={accounts}
              />
            ))}
          </table>
        </section>
      ))}
    </div>
  );
}
