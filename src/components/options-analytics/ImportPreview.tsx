"use client";
import { useState } from "react";
import type {
  ActivityImportPreview,
  ImportReconciliation,
} from "@/lib/imports/wealthsimple-activity";
import { decimalNumber, type Decimal } from "@/lib/financial/decimal";
import { Money } from "@/components/shared/Money";
import { PrivateValue } from "@/components/shared/BalancePrivacy";
import { StatCard } from "@/components/shared/StatCard";
import styles from "./ImportPreview.module.css";
import {
  OPTIONS_CURRENCY,
  OPTIONS_CURRENCY_NOTE,
} from "@/lib/options/currency";

export function ImportPreview({
  data,
  reconciliation,
}: {
  data: ActivityImportPreview;
  reconciliation?: ImportReconciliation;
}) {
  const active =
    reconciliation?.optionsSource === "csv" && !!reconciliation.csvOptionRows;
  const [search, setSearch] = useState(""),
    [account, setAccount] = useState("all"),
    [page, setPage] = useState(0);
  const rows = data.rows.filter(
    (r) =>
      (account === "all" || r.account === account) &&
      `${r.symbol} ${r.action}`.toLowerCase().includes(search.toLowerCase()),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / 25) - 1),
  );
  const missingAction = data.rows.filter(
    (r) => ["BUY", "SELL"].includes(r.action) && !r.explicitAction,
  ).length;
  const candidates = data.rows.filter((r) => r.candidateAction).length;
  const money = (value: Decimal | null) => (
    <Money
      value={{ amount: decimalNumber(value), currency: OPTIONS_CURRENCY }}
      signed
    />
  );
  return (
    <StatCard
      title="Wealthsimple CSV preview"
      action={
        <span>
          {active
            ? "Source for CSV-based trade estimates"
            : "Not applied to returns"}
        </span>
      }
    >
      <p>
        {data.files} files · {data.records} activity rows · {data.rows.length}{" "}
        option rows · {data.accounts} source accounts.
      </p>
      {data.earliest && (
        <p>
          Export coverage: {data.earliest} through {data.latest}. This does not
          prove lifetime completeness.
        </p>
      )}
      <p>
        {OPTIONS_CURRENCY_NOTE}{" "}
        {active ? (
          "Account matches and source precedence are listed in the reconciliation results below. These are source activities, not separate profit figures; incomplete lifecycles remain excluded."
        ) : (
          <>
            Preview only. CSV accounts are aliases and have not been matched to
            SnapTrade accounts. These rows are not added to the brokerage ledger
            or performance totals, preventing duplicate counting.
          </>
        )}
      </p>
      {missingAction > 0 && (
        <p role="status">
          {missingAction} buy/sell rows lack explicit opening/closing
          instructions. {candidates} have candidate classifications from the
          source LONG/SHORT field.{" "}
          {active
            ? "The CSV-based estimates use this source-side interpretation; it is not an explicitly reported opening/closing instruction."
            : "These interpretations require verification before use in returns."}
        </p>
      )}
      {data.possibleDuplicates > 0 && (
        <p>
          {data.possibleDuplicates} potentially repeated rows need review;
          identical fills are not automatically merged.
        </p>
      )}
      {!!data.warnings.length && (
        <ul>
          {data.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      <details>
        <summary>Review imported options activity</summary>
        <p>
          These filters apply only to the CSV preview. Net cash and commission
          are displayed as exported, separately; they are not summed together or
          treated as profit.
        </p>
        <div className={styles.controls}>
          <label>
            Search CSV contracts
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            CSV source account
            <select
              aria-label="CSV source account"
              value={account}
              onChange={(e) => {
                setAccount(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All CSV accounts</option>
              {[...new Set(data.rows.map((r) => r.account))].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
        {!rows.length ? (
          <p>
            No imported options match this selection. Unsupported CSVs are
            listed above.
          </p>
        ) : (
          <>
            <table className={styles.table}>
              <caption className={styles.caption}>
                Exported options activity, separate from calculated performance
              </caption>
              <thead>
                <tr>
                  {[
                    "Date",
                    "Contract / source",
                    "Action",
                    "Quantity",
                    "Net cash",
                    "Commission",
                  ].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice(currentPage * 25, currentPage * 25 + 25)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.date || "Unavailable"}</td>
                      <th scope="row">
                        <strong>{r.symbol}</strong>
                        <small>
                          {r.account} · {r.source} · row {r.row}
                        </small>
                        <details>
                          <summary>Source details</summary>
                          <p>Unit price: {money(r.price)}</p>
                          {r.currency !== OPTIONS_CURRENCY && (
                            <p>
                              Reported source currency:{" "}
                              {r.currency || "Unavailable"}. The app assumes
                              USD.
                            </p>
                          )}
                          <ul>
                            {r.issues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                            <li>
                              {active
                                ? "Eligibility depends on full lifecycle and cash reconciliation; this raw row is not a separate profit figure."
                                : "Account mapping is unverified; row is excluded from performance."}
                            </li>
                            {r.possibleDuplicate && (
                              <li>
                                Potential duplicate: verify against other source
                                rows.
                              </li>
                            )}
                          </ul>
                        </details>
                      </th>
                      <td>
                        {r.action}
                        {r.side && <small>Source side: {r.side}</small>}
                        {r.candidateAction && (
                          <small>Candidate: {r.candidateAction}</small>
                        )}
                      </td>
                      <td>
                        <PrivateValue>
                          {r.quantity ?? "Unavailable"}
                        </PrivateValue>
                      </td>
                      <td>{money(r.netCash)}</td>
                      <td>{money(r.commission)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className={styles.controls}>
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous CSV page
              </button>
              <span role="status">
                Page {currentPage + 1} of {Math.ceil(rows.length / 25)} ·{" "}
                {rows.length} option rows
              </span>
              <button
                type="button"
                disabled={(currentPage + 1) * 25 >= rows.length}
                onClick={() => setPage(currentPage + 1)}
              >
                Next CSV page
              </button>
            </div>
          </>
        )}
      </details>
      <p>
        Original exports remain in the git-ignored private-data/wealthsimple
        folder. No source account IDs or filenames are embedded in application
        code.
      </p>
    </StatCard>
  );
}
