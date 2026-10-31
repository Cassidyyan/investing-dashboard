import type { ImportReconciliation } from "@/lib/imports/wealthsimple-activity";
import styles from "@/styles/dashboard.module.css";
export function ImportReconciliationNotice({
  report,
}: {
  report?: ImportReconciliation;
}) {
  if (!report) return null;
  return (
    <aside className={styles.notice} aria-label="CSV reconciliation results">
      <strong>CSV reconciliation</strong>: {report.mappedAccounts} source
      accounts matched · {report.matched} existing activities enriched ·{" "}
      {report.added} additional activities · {report.conflicts} conflicts ·{" "}
      {report.unmatched} unmatched.
      {!!report.pendingAdditional && (
        <p>
          {report.pendingAdditional} CSV-only stock activities need ending-share
          reconciliation and have not been added to returns.
        </p>
      )}
      <p>
        Overlapping executions are counted once. Account matches require
        multiple corroborating trades. CSV classifications use the reported
        LONG/SHORT side; net cash includes reported commission. Conflicts are
        not automatically merged; incomplete lifecycles remain excluded. API
        coverage dates still describe API records only.
      </p>
      {report.optionsSource === "csv" && (
        <p>
          <strong>
            Options trade history uses the CSV for its covered dates.
          </strong>{" "}
          {report.csvOptionRows} CSV option rows replace{" "}
          {report.overlappingApiOptions} overlapping API observations in that
          period; those observations are not counted as additional trades. These
          are CSV-based trade estimates, not verified lifetime or
          broker-reported P&amp;L. {report.unallocatedAccountFees} unallocated
          account-fee records are excluded from trade P&amp;L; commission
          reported on each imported trade remains included.
        </p>
      )}
    </aside>
  );
}
