import { PrivateValue } from "@/components/shared/BalancePrivacy";
import { InfoPopover } from "@/components/shared/InfoPopover";
import type { AccountData } from "@/lib/types";
import { cashFigureReview } from "@/lib/cash";
import { date, money, cashMoney } from "@/lib/format";
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
          const initials =
            a.account.institution
              .replace(/[^A-Za-z0-9]/g, "")
              .slice(0, 2)
              .toUpperCase() || "?";
          return (
            <tbody
              key={a.account.id}
              id={`cash-account-${a.account.id}`}
              className={accountStyles.accountGroup}
            >
              <tr className={accountStyles.primaryRow}>
                <td className={accountStyles.identity}>
                  <div className={styles.identity}>
                    <span className={styles.institutionIcon} aria-hidden="true">
                      {initials}
                    </span>
                    <div className={styles.identityText}>
                      <strong>{a.account.name}</strong>
                      <small>
                        {a.account.institution} · {a.account.suffix}
                      </small>
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
                          <PrivateValue placeholder="••••">
                            {cashMoney(b.cash)}
                          </PrivateValue>
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
                      <PrivateValue placeholder="••••">
                        {money(a.account.value)}
                      </PrivateValue>
                    </strong>
                    <InfoPopover
                      label={`Cash and reported total information for ${a.account.name}`}
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
                          same currency. Check the brokerage’s definitions and
                          synchronization before treating this as an error.
                        </p>
                      )}
                      {review === "multi-currency" && (
                        <p>
                          This account contains another currency. Its native
                          cash amounts cannot be added directly to compare with
                          one reported total.
                        </p>
                      )}
                      {review === "unavailable" && (
                        <p>
                          Some fields are missing; the two figures cannot be
                          fully compared.
                        </p>
                      )}
                    </InfoPopover>
                  </div>
                  {review === "different" && (
                    <small className={styles.noticeText}>
                      Figures differ · see information
                    </small>
                  )}
                  {review === "multi-currency" && (
                    <small>May include currency conversion</small>
                  )}
                </td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
