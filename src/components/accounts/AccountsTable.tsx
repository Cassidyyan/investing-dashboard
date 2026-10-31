"use client";
import { useId, useState } from "react";
import { Money } from "@/components/shared/Money";
import { accountCurrencyTotals } from "@/lib/accounts/currency-totals";
import type { AccountData } from "@/lib/types";
import { date } from "@/lib/format";
import styles from "./Accounts.module.css";
const amount = (value: AccountData["account"]["value"]) => (
  <Money value={value} />
);
export function AccountsTable({ accounts }: { accounts: AccountData[] }) {
  return (
    <div className={styles.accountsTableWrap}>
      <table className={styles.accountsTable} role="table">
        <caption className={styles.srOnly}>
          Investing accounts: reported totals, cash, and last successful
          holdings sync. Expand each account for estimates and buying power.
        </caption>
        <colgroup>
          <col className={styles.accountColumn} />
          <col className={styles.valueColumn} />
          <col className={styles.cashColumn} />
          <col className={styles.syncColumn} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col" className={styles.numeric}>
              Reported total
            </th>
            <th scope="col">Cash</th>
            <th scope="col">
              <span className={styles.srOnly}>Details</span>
            </th>
          </tr>
        </thead>
        {accounts.map((a) => (
          <AccountRow
            key={a.account.id}
            a={a}
            showSyncTimes={
              new Set(accounts.map((r) => r.account.syncedAt)).size > 1
            }
          />
        ))}
      </table>
    </div>
  );
}

function AccountRow({
  a,
  showSyncTimes,
}: {
  a: AccountData;
  showSyncTimes: boolean;
}) {
  const totals = accountCurrencyTotals(a);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <tbody
      key={a.account.id}
      id={`account-${a.account.id}`}
      className={styles.accountGroup}
    >
      <tr className={styles.primaryRow}>
        <td className={styles.identity}>
          <div className={styles.identityHeading}>
            <strong title={a.account.name}>{a.account.name}</strong>
            <span className={styles.typeBadge}>{a.account.type}</span>
          </div>
          <div className={styles.identityMeta}>
            <span>{a.account.suffix}</span>
          </div>
          <small>{a.account.institution}</small>
          {showSyncTimes && (
            <span className={styles.rowSync}>
              <span>Last synced · </span>
              <time dateTime={a.account.syncedAt || undefined}>
                {date(a.account.syncedAt)}
              </time>
              {a.account.stale && (
                <small className={styles.warning}>Over 36 hours old</small>
              )}
              {a.account.incomplete && (
                <small className={styles.warning}>Holdings incomplete</small>
              )}
            </span>
          )}
        </td>
        <td className={styles.numeric}>
          <span className={styles.mobileLabel}>Reported total</span>
          <strong className={styles.reportedValue}>
            {amount(a.account.value)}
          </strong>

          {(a.account.stale || a.account.incomplete) && (
            <small className={styles.warning}>Stale / incomplete</small>
          )}
        </td>
        <td>
          <span className={styles.mobileLabel}>Cash</span>
          <div className={styles.cashLine}>
            {a.balances.status === "error" ? (
              "Cash unavailable"
            ) : !a.balances.data.length ? (
              "No cash balances reported"
            ) : (
              <span className={styles.cashValues}>
                {a.balances.data.map((b, i) => (
                  <Money key={i} value={b.cash} cash />
                ))}
              </span>
            )}
          </div>
        </td>
        <td className={styles.expandCell}>
          <button
            type="button"
            className={styles.expandButton}
            aria-label={`Estimates & buying power for ${a.account.name}`}
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            ⌄
          </button>
        </td>
      </tr>
      <tr className={styles.detailRow} hidden={!expanded}>
        <td colSpan={4}>
          <div id={id} hidden={!expanded} className={styles.accountDetails}>
            <h3 className={styles.srOnly}>Estimates & buying power</h3>
            <div className={styles.detailGrid}>
              <section aria-label={`${a.account.name} estimated values`}>
                <h3>Estimated from holdings</h3>
                <p>Includes reported cash; native currencies kept separate.</p>
                <dl>
                  <div>
                    <dt>CAD estimate</dt>
                    <dd>{amount({ amount: totals.cad, currency: "CAD" })}</dd>
                  </div>
                  <div>
                    <dt>USD estimate</dt>
                    <dd>{amount({ amount: totals.usd, currency: "USD" })}</dd>
                  </div>
                </dl>
                {totals.incomplete && (
                  <p className={styles.warning}>
                    Partial / stale estimate. Some balances or valuations are
                    unavailable.
                  </p>
                )}
                {totals.otherCurrencies.length > 0 && (
                  <p>
                    Other currencies excluded:{" "}
                    {totals.otherCurrencies.join(", ")}.
                  </p>
                )}
              </section>
              <section aria-label={`${a.account.name} cash and buying power`}>
                <h3>Cash & buying power</h3>
                {a.balances.status === "error" ? (
                  <p>Balances could not be loaded. Try Refresh.</p>
                ) : !a.balances.data.length ? (
                  <p>No balances reported.</p>
                ) : (
                  <dl>
                    {a.balances.data.map((b, i) => (
                      <div key={i} className={styles.balanceDetails}>
                        <dt>{b.cash.currency || "Unknown currency"} cash</dt>
                        <dd>
                          <Money value={b.cash} cash />
                        </dd>
                        <dt>Buying power</dt>
                        <dd>{amount(b.buyingPower)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p>
                  Buying power is shown as reported; it is not added to account
                  value.
                </p>
              </section>
            </div>
          </div>
        </td>
      </tr>
    </tbody>
  );
}
