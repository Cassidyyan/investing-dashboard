import { useState } from "react";
import type { HoldingReturn } from "@/lib/returns/holding-returns";
import { LeaderboardRow } from "./LeaderboardRow";
import styles from "./Returns.module.css";
export function LeaderboardTable({
  rows,
  currency,
  names,
  max,
}: {
  rows: HoldingReturn[];
  currency: string;
  names: Record<string, string>;
  max: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, 10);
  if (!rows.length)
    return (
      <p className={styles.empty}>No ranked holdings match this selection.</p>
    );
  return (
    <>
      <table className={styles.leaderboard} role="table">
        <caption className={styles.srOnly}>
          Ranked holding profits in {currency}. Return % is on total purchase
          outflows. Expand holding details for accounts, sales and calculation
          notes.
        </caption>
        <colgroup>
          <col className={styles.holdingCol} />
          <col className={styles.profitCol} />
          <col className={styles.percentCol} />
          <col className={styles.detailCol} />
          <col className={styles.dividendCol} />
          <col className={styles.chevronColumn} />
        </colgroup>
        <thead>
          <tr>
            {[
              "Holding",
              "Total profit",
              "Return %",
              "Realized / Unrealized",
              "Dividends",
            ].map((heading, i) => (
              <th
                key={heading}
                scope="col"
                className={i ? styles.numeric : undefined}
              >
                {heading}
              </th>
            ))}
            <th scope="col">
              <span className={styles.srOnly}>Details</span>
            </th>
          </tr>
        </thead>
        {shown.map((row, i) => (
          <LeaderboardRow
            row={row}
            rank={i + 1}
            name={names[row.symbol]}
            max={max}
            key={row.key}
          />
        ))}
      </table>
      {rows.length > 10 && (
        <button
          type="button"
          className={styles.textButton}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show top 10" : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}
