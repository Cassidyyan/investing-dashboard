import { Money } from "@/components/shared/Money";
import { InfoPopover } from "@/components/shared/InfoPopover";
import type { AccountData } from "@/lib/types";
import { cashFigureReview } from "@/lib/cash/cash";
import { date } from "@/lib/format";
import accountStyles from "@/components/accounts/Accounts.module.css";
import styles from "./Cash.module.css";
export function CashAccountsTable({
  accounts,
  showSyncTimes = false,
}: {
  accounts: AccountData[];
  showSyncTimes?: boolean;
}) {
  return (
    <div className={accountStyles.accountsTableWrap}>
      <table
        className={`${accountStyles.accountsTable} ${styles.cashTable}`}
        role="table"
      >
        <caption className={accountStyles.srOnly}>
          Cash accounts with native cash balances and brokerage-reported account
          totals. Values are preserved as reported.
        </caption>
        <colgroup>
          <col className={styles.accountColumn} />
          <col className={styles.cashColumn} />
          <col className={styles.totalColumn} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col" className={accountStyles.numeric}>
              Cash by currency
            </th>
            <th scope="col" className={accountStyles.numeric}>
              Reported total
            </th>
          </tr>
        </thead>
        {accounts.map((a) => {
          const deposit = a.account.category === "DEPOSIT",
            review = cashFigureReview(a);
          return (
            <tbody
              key={a.account.id}
              id={`cash-account-${a.account.id}`}
              className={accountStyles.accountGroup}
            >
              <tr className={`${accountStyles.primaryRow} ${styles.cashRow}`}>
                <td className={accountStyles.identity}>
                  <div className={styles.identity}>
                    <span className={styles.institutionIcon} aria-hidden="true">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        {deposit ? (
                          <>
                            <path d="m3 9 9-6 9 6M3 21h18M5 10v9m7-9v9m7-9v9" />
                          </>
                        ) : (
                          <>
                            <rect x="3" y="6" width="18" height="14" rx="3" />
                            <path d="M4 6V4h14M16 11h5v5h-5z" />
                          </>
                        )}
                      </svg>
                    </span>
                    <div className={styles.identityText}>
                      <div className={styles.identityHeading}>
                        <strong title={a.account.name}>{a.account.name}</strong>
                        <InfoPopover
                          label={`Classification for ${a.account.name}`}
                          trigger={deposit ? "Deposit / banking" : "HYSA"}
                          badge
                          align="start"
                        >
                          <p>
                            {deposit
                              ? "The brokerage explicitly reports this account as deposit / banking (DEPOSIT)."
                              : "By your preference, this cash-only investing account is treated as a high-yield savings account (HYSA), assumed to earn a higher yield than chequing. This is your personal classification, not a verified brokerage account type or interest rate. No APY or interest earnings are calculated without a supplied rate."}
                          </p>
                          <p>
                            Reported type: {a.account.type}. No account has been
                            changed or reclassified at the brokerage.
                          </p>
                        </InfoPopover>
                      </div>
                      <small>
                        {a.account.institution} · {a.account.suffix}
                      </small>
                      {showSyncTimes && (
                        <small>
                          Account sync:{" "}
                          <time dateTime={a.account.syncedAt || undefined}>
                            {date(a.account.syncedAt)}
                          </time>{" "}
                          {a.account.syncedAt ? "ET" : ""}
                        </small>
                      )}
                      {(a.account.stale || a.account.incomplete) && (
                        <small className={styles.noticeText}>
                          {a.account.stale
                            ? "Sync is over 36 hours old"
                            : "Incomplete account data"}
                        </small>
                      )}
                    </div>
                  </div>
                </td>
                <td className={accountStyles.numeric}>
                  <span className={accountStyles.mobileLabel}>
                    Cash by currency
                  </span>
                  {a.balances.status === "error" ? (
                    <span className={styles.noticeText}>
                      Cash balances unavailable
                    </span>
                  ) : !a.balances.data.length ? (
                    <span className={styles.noticeText}>
                      No cash balances reported
                    </span>
                  ) : (
                    <ul className={styles.cashBalances}>
                      {a.balances.data.map((b, i) => (
                        <li key={i}>
                          <Money value={b.cash} cash />
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className={accountStyles.numeric}>
                  <span className={accountStyles.mobileLabel}>
                    Reported total
                  </span>
                  <div className={styles.reportedLine}>
                    <strong className={accountStyles.reportedValue}>
                      <Money value={a.account.value} />
                    </strong>
                    <InfoPopover
                      label={`${review === "different" ? "Figures differ. " : ""}Cash and reported total information for ${a.account.name}`}
                      trigger={review === "different" ? "•" : "i"}
                    >
                      <p>
                        Cash by currency lists cash balances supplied for each
                        currency. Reported total is the brokerage’s
                        account-level value. It may combine currencies, use
                        another snapshot, or have a different scope.
                      </p>
                      <p>
                        The app displays both as received and does not force
                        them to match.
                      </p>
                      {review === "different" && (
                        <p>
                          The reported total differs from the cash sum in the
                          same currency. Values are preserved as reported.
                        </p>
                      )}
                      {review === "multi-currency" && (
                        <p>
                          Native cash currencies cannot be directly added to
                          compare with one reported total.
                        </p>
                      )}
                      {review === "unavailable" && (
                        <p>Missing fields prevent a full comparison.</p>
                      )}
                    </InfoPopover>
                  </div>
                </td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
