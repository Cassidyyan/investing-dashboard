"use client";
import { useEffect, useId, useRef } from "react";
import styles from "./Returns.module.css";
export function EstimatesDrawer({
  open,
  onClose,
  issues,
}: {
  open: boolean;
  onClose: () => void;
  issues: string[];
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const node = dialog.current;
    if (open && !node?.open) node?.showModal();
    else if (!open && node?.open) node.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={styles.drawer}
      aria-labelledby={id}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          onClose();
      }}
    >
      <div className={styles.drawerHeader}>
        <h2 id={id}>About these estimates</h2>
        <button
          type="button"
          aria-label="Close estimates details"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className={styles.drawerBody}>
        <p>
          Estimates cover available SnapTrade transactions across currently
          connected investing accounts, including sold holdings and zero-balance
          accounts. Older brokerage history may be missing. “Lifetime” is not a
          guarantee of complete all-time records.
        </p>
        <h3>Partial-history account notes</h3>
        {issues.length ? (
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p>
            No account-level coverage warnings were returned. This does not
            verify that older brokerage history is complete.
          </p>
        )}
        <h3>How these estimates work</h3>
        <p>
          Total profit = realized sales profit + unrealized profit + reported
          dividends − separately attributed charges. Losing sales reduce the
          total. A weighted average purchase cost matches shares to each sale,
          separately in each account.
        </p>
        <p>
          Return % = total profit ÷ total purchase cash outflows, including
          repeat purchases. This is a simple cumulative return on purchases, not
          an annualized, time-weighted, or money-weighted return. Repeated
          trading changes the denominator.
        </p>
        <p>
          Amounts use reported transaction cash flows. Records with nonzero
          trade fees, missing purchases, uncertain same-day ordering, unmatched
          transfers, splits, reinvestment events, or missing currency rates are
          excluded from ranking until reconciled. Separate account-wide fees or
          taxes without a ticker cannot be allocated and are excluded. Cash
          dividends are included as reported; no dividend reinvestment or tax
          treatment is assumed.
        </p>
        <p>
          For uniquely matched zero-cash share transfers within the same
          brokerage, the original recorded purchase cost moves with the shares.
          Both ending share counts must prove the transfer direction. This adds
          no sale profit, no extra purchase outflow, and no taxable-gain
          assumption.
        </p>
        <p>
          Transactions without a ticker are shown as coverage warnings and
          cannot be attributed to a holding. They do not automatically block
          every other stock in the account. Rankings cover matched records;
          unmatched older trades or dividends may change these estimates.
        </p>
        <p>
          CAD and USD profits are ranked separately in each security’s currency.
          Where transaction cash flows use a different currency, historical Bank
          of Canada daily reference rates estimate the conversion. The most
          recent published rate on or before the transaction is used, up to
          seven days earlier; these estimates may differ from actual brokerage
          conversions. Options, short positions, and unsupported instruments are
          excluded. Snapshot timing and brokerage retention limits can affect
          coverage. These are analytical estimates, not tax calculations.
        </p>
        <h3>Bank of Canada rate source</h3>
        <p>
          Each historical FX estimate uses the reference rate appropriate to its
          transaction date, not a single current rate. Toggle currencies to view
          separate native amounts; no extra conversion is applied by the page.
        </p>
        <a
          href="https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/"
          target="_blank"
          rel="noreferrer"
        >
          Bank of Canada daily reference rates ↗
        </a>
        <h3>Why these totals differ from other pages</h3>
        <p>
          This leaderboard estimates profit on eligible stocks and funds,
          including recorded sales, current unrealized profit, dividends and
          attributed charges. Overview and account pages show account values,
          including cash, while Holdings allocation uses positive current
          positions. Unranked holdings and unsupported instruments are excluded
          from profit totals. Scope, currencies and source dates can differ.
        </p>
      </div>
    </dialog>
  );
}
