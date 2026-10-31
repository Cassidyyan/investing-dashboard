import { useState } from "react";
import type { HoldingReturn } from "@/lib/returns/holding-returns";
import {
  groupedReasons,
  isFxEstimate,
  recoveryAction,
} from "@/lib/returns/presentation";
import { StatCard } from "@/components/shared/StatCard";
import { SecurityIcon } from "@/components/shared/SecurityIcon";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { ReturnAmount } from "./ReturnValue";
import styles from "./Returns.module.css";
export function NeedsDataCard({
  rows,
  currency,
}: {
  rows: HoldingReturn[];
  currency: string;
}) {
  const [reason, setReason] = useState("all");
  if (!rows.length) return null;
  const counts = new Map<string, number>();
  for (const row of rows)
    for (const group of groupedReasons(row))
      counts.set(group.label, (counts.get(group.label) || 0) + 1);
  const selected = counts.has(reason) ? reason : "all",
    filtered =
      selected === "all"
        ? rows
        : rows.filter((r) =>
            groupedReasons(r).some((g) => g.label === selected),
          );
  return (
    <StatCard
      title={`${rows.length} holdings can’t be ranked yet`}
      action={
        <InfoPopover label="Missing-data reason counts">
          <p>
            Reason groups come from the existing calculation issues and do not
            change eligibility. A holding can have several reasons, so chip
            counts can overlap.
          </p>
        </InfoPopover>
      }
    >
      <p className={styles.caption}>
        Historical cost, trade or currency details need reconciliation. Reported
        dividends below are excluded from ranked profit totals · {currency}.
      </p>
      <div
        className={styles.reasonChips}
        role="group"
        aria-label="Filter missing-data reasons"
      >
        <button
          type="button"
          aria-pressed={selected === "all"}
          onClick={() => setReason("all")}
        >
          All · {rows.length}
        </button>
        {[...counts].map(([label, count]) => (
          <button
            type="button"
            key={label}
            aria-pressed={selected === label}
            onClick={() => setReason(label)}
          >
            {label} · {count}
          </button>
        ))}
      </div>
      <table className={styles.needsTable} role="table">
        <caption className={styles.srOnly}>
          Unranked holdings, reported dividends and reasons in {currency}
        </caption>
        <thead>
          <tr>
            <th scope="col">Holding</th>
            <th scope="col">Reported dividends</th>
            <th scope="col">Reason</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.key}>
              <td>
                <div className={styles.security}>
                  <SecurityIcon
                    symbol={row.symbol}
                    logoUrl={row.logoUrl ?? null}
                  />
                  <strong>{row.symbol}</strong>
                  {!!row.importedActivities && (
                    <small>
                      {row.importedActivities} activities reconciled with CSV ·
                      history gaps remain
                    </small>
                  )}
                  {isFxEstimate(row) && (
                    <InfoPopover
                      label={`Dividend FX estimate for ${row.symbol}`}
                      trigger="FX est."
                      badge
                    >
                      {row.notes
                        ?.filter((note) =>
                          note.startsWith("Historical FX estimate"),
                        )
                        .map((note) => (
                          <p key={note}>{note}</p>
                        ))}
                    </InfoPopover>
                  )}
                  <InfoPopover
                    label={`Accounts for ${row.symbol}`}
                    trigger={`${row.accounts.length} ${row.accounts.length === 1 ? "account" : "accounts"}`}
                    badge
                    align="start"
                  >
                    <p>
                      {row.accounts.join(" · ") || "Account names unavailable."}
                    </p>
                  </InfoPopover>
                </div>
              </td>
              <td>
                <span className={styles.mobileLabel}>Reported dividends</span>
                <ReturnAmount value={row.dividends} currency={row.currency} />
              </td>
              <td>
                <div className={styles.reasonBadges}>
                  {groupedReasons(row).map((group) => (
                    <InfoPopover
                      key={group.label}
                      label={`${row.symbol}: ${group.label}`}
                      trigger={group.label}
                      badge
                    >
                      {group.issues.map((issue) => (
                        <p key={issue}>{issue}</p>
                      ))}
                      {!!row.sourceGaps?.length && (
                        <ul>
                          {row.sourceGaps
                            .filter((gap) =>
                              gap.issues.some((issue) =>
                                group.issues.includes(issue),
                              ),
                            )
                            .map((gap, index) => (
                              <li key={index}>
                                <strong>{gap.account}</strong>:{" "}
                                {gap.earliest ? (
                                  <>
                                    available activity {gap.earliest} →{" "}
                                    {gap.latest}; first event {gap.firstEvent}.
                                  </>
                                ) : (
                                  "No dated activity is available for this holding."
                                )}
                              </li>
                            ))}
                        </ul>
                      )}
                      <p>
                        <strong>Next step:</strong>{" "}
                        {recoveryAction(group.label)}
                      </p>
                    </InfoPopover>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </StatCard>
  );
}
