import { StatCard } from "@/components/shared/StatCard";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { Money } from "@/components/shared/Money";
import { PrivateValue } from "@/components/shared/BalancePrivacy";
import type {
  OptionsData,
  OptionsFilters,
} from "@/lib/options/analytics-types";
import styles from "./OptionsAnalytics.module.css";
import { HistoryCoverage } from "@/components/shared/HistoryCoverage";
import { OPTIONS_CURRENCY_NOTE } from "@/lib/options/currency";
export function OptionsCoverage({
  data,
  filters,
}: {
  data: OptionsData;
  filters: OptionsFilters;
}) {
  const dates = data.trades
    .flatMap((t) => t.executions.map((e) => e.tradeDate))
    .sort();
  const positions = data.openPositions.filter(
    (p) =>
      (filters.account === "all" || p.accountId === filters.account) &&
      (filters.ticker === "all" || p.ticker === filters.ticker) &&
      p.currency === filters.currency &&
      (filters.right === "all" || p.right === filters.right),
  );
  const excluded = data.trades.filter(
    (t) =>
      t.status === "needs-review" &&
      (filters.account === "all" || t.accountId === filters.account),
  );
  return (
    <>
      <StatCard
        title="Current open option positions"
        action={
          <InfoPopover label="Current positions scope">
            Current brokerage positions are a separate snapshot. Account,
            ticker, currency and put/call filters apply; historical date and
            lifecycle status apply to the ledger, not this snapshot. Missing
            position requests are disclosed in coverage.
          </InfoPopover>
        }
      >
        {!positions.length ? (
          <p>
            No available current positions in this account/ticker/currency
            selection.
          </p>
        ) : (
          <ul className={styles.positionList}>
            {positions.map((p, i) => (
              <li key={i}>
                <span>
                  <strong>{p.ticker}</strong>
                  <small>{p.symbol}</small>
                </span>
                <span>
                  <PrivateValue>{p.quantity ?? "Unavailable"}</PrivateValue>{" "}
                  contracts
                  <small>
                    <Money value={{ amount: p.value, currency: p.currency }} />
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </StatCard>
      <StatCard
        title="Data coverage & reconciliation"
        action={
          <InfoPopover label="Options accounting methodology">
            This page uses transaction activities only; cumulative order
            snapshots are not counted as fills. {OPTIONS_CURRENCY_NOTE} A
            matched local CSV can supply trade history for its covered dates;
            figures are source-labelled trade estimates, and unrelated account
            fees are not allocated. No currency conversion is used.
            Zero-settlement expiration needs an explicit event, quantity,
            currency and zero fee. Assignments and exercises require settlement
            reconciliation. Entry delta, collateral returns and automatic
            strategy classifications are unavailable.
          </InfoPopover>
        }
      >
        <p>
          {data.accounts.length} investing accounts · {data.trades.length}{" "}
          observed lifecycles/events ·{" "}
          {data.trades.filter((t) => t.status === "needs-review").length} need
          review.
        </p>
        <p>
          {dates.length
            ? `Dated execution coverage: ${dates[0]} through ${dates.at(-1)}.`
            : "No reliably dated option executions are available."}{" "}
          Earliest/latest observations do not prove complete history. Account
          history paginates without a year or record-count cutoff. A two-minute
          read budget can leave partial coverage explicitly flagged.
        </p>
        <details>
          <summary>Calculation notes and excluded trades</summary>
          <p>
            Realized P&L sums proportional opening and closing net cash on
            confirmed matching quantities. A lifecycle is complete only when its
            open quantity returns to zero. Breakeven trades are included in the
            win-rate denominator. Premium cash flow is before fees and is never
            substituted for realized profit. Money allocation uses 12 decimal
            places with residual conservation; the UI rounds native currency for
            display.
          </p>
          <p>
            Historical multipliers are often missing. Explicit zero-fee signed
            amounts, or CSV-reported net cash with reported commission, can
            support cash-based P&L without a multiplier. Other nonzero-fee API
            records require price/quantity/multiplier reconciliation. Missing
            fees, ambiguous sequencing, related unallocated charges, incomplete
            histories and conflicting fields block eligibility.
          </p>
          <ul>
            {data.issues
              .filter(
                (i) =>
                  filters.account === "all" || i.accountId === filters.account,
              )
              .map((issue, i) => (
                <li key={i}>
                  {data.accounts.find((a) => a.id === issue.accountId)?.name ||
                    "Account"}
                  : {issue.reason}
                </li>
              ))}
            {excluded.map((t) => (
              <li key={t.id}>
                <strong>
                  {t.ticker} · {t.contract?.symbol || "Unrecognized contract"}
                </strong>
                : {t.issues.join(" ")}
              </li>
            ))}
          </ul>
          {!data.issues.length && !excluded.length && (
            <p>
              No blocking issues were found in the available source records.
              Earlier unreported activity may still be missing.
            </p>
          )}
        </details>
      </StatCard>
      <HistoryCoverage
        rows={(data.historyCoverage || [])
          .filter(
            (row) =>
              filters.account === "all" || row.accountId === filters.account,
          )
          .map((row) => ({
            label:
              data.accounts.find((a) => a.id === row.accountId)?.name ||
              "Account",
            coverage: row.coverage,
            sync: row.sync,
          }))}
      />
    </>
  );
}
