import type { CoverageRow } from "@/lib/financial/history-coverage";
import { date } from "@/lib/format";
import styles from "./HistoryCoverage.module.css";
export function HistoryCoverage({ rows }: { rows: CoverageRow[] }) {
  if (!rows.length) return null;
  return (
    <details className={styles.coverage}>
      <summary>
        Transaction history coverage · {rows.length}{" "}
        {rows.length === 1 ? "account" : "accounts"}
      </summary>
      <p>
        Pagination completion means the available API pages were retrieved.
        Brokerage lifetime coverage remains unverified. Activity dates are not
        account-opening dates. History reads may be reused in memory for 60
        seconds; Refresh can reuse that snapshot until expiry. No history is
        stored on disk.
      </p>
      <div className={styles.accounts}>
        {rows.map((row, index) => (
          <section key={index} aria-label={`${row.label} transaction coverage`}>
            <h3>{row.label}</h3>
            <dl>
              {row.sync?.firstTransactionDate &&
                row.coverage.earliest &&
                row.sync.firstTransactionDate < row.coverage.earliest && (
                  <div>
                    <dt>Possible earlier history</dt>
                    <dd>
                      Provider metadata predates the retrieved records;
                      brokerage coverage needs verification.
                    </dd>
                  </div>
                )}
              <div>
                <dt>Available dated records</dt>
                <dd>
                  {row.coverage.earliest || "Unavailable"} →{" "}
                  {row.coverage.latest || "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Unique transactions</dt>
                <dd>
                  {row.coverage.records} · {row.coverage.pages} pages · API
                  total {row.coverage.expectedTotal ?? "not supplied"}
                </dd>
              </div>
              <div>
                <dt>API pagination</dt>
                <dd>
                  {row.coverage.status === "complete"
                    ? "Complete available pages"
                    : "Partial — dependent returns unavailable"}
                  {row.coverage.errorCode &&
                    ` · ${row.coverage.errorCode.replaceAll("_", " ")}`}
                </dd>
              </div>
              <div>
                <dt>Source retrieved</dt>
                <dd>
                  {date(row.coverage.retrievedAt)} ·{" "}
                  {row.coverage.cache === "cached"
                    ? "Reused snapshot"
                    : "New read"}
                </dd>
              </div>
              <div>
                <dt>Transaction initial sync</dt>
                <dd>
                  {row.sync?.initialSyncCompleted === true
                    ? "Completed"
                    : row.sync?.initialSyncCompleted === false
                      ? "Incomplete"
                      : "Unknown"}
                </dd>
              </div>
              <div>
                <dt>Provider first transaction date</dt>
                <dd>{row.sync?.firstTransactionDate || "Unavailable"}</dd>
              </div>
              <div>
                <dt>Last transaction sync</dt>
                <dd>
                  {row.sync?.lastSuccessfulSync || "Unavailable"}
                  {row.sync?.invalidMetadata
                    ? " · invalid metadata reported"
                    : ""}
                </dd>
              </div>
              <div>
                <dt>Options / identical duplicates ignored</dt>
                <dd>
                  {row.coverage.optionRecords} / {row.coverage.duplicates}
                </dd>
              </div>
            </dl>
            <details>
              <summary>Source field availability</summary>
              <p>
                Counts apply only to relevant records, such as trade fees on
                trades. Missing reference IDs or settlement dates are not
                automatically financial errors. Source omissions cannot identify
                whether Wealthsimple or SnapTrade omitted the field.
              </p>
              <ul>
                {row.coverage.fields.map((field) => (
                  <li key={field.field}>
                    {field.field}: {field.missing} missing, {field.invalid}{" "}
                    invalid / {field.applicable} applicable records
                  </li>
                ))}
              </ul>
              <p>
                Option events: {row.coverage.events.expiration} expiration,{" "}
                {row.coverage.events.assignment} assignment,{" "}
                {row.coverage.events.exercise} exercise. Historical
                account-value history is a separate beta source with a maximum
                one-year lookback; transactions can be older.
              </p>
            </details>
          </section>
        ))}
      </div>
    </details>
  );
}
