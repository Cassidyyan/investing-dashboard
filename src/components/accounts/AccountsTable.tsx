import { PrivateValue } from "@/components/shared/BalancePrivacy";
import { accountCurrencyTotals } from "@/lib/currency-totals";
import type { AccountData } from "@/lib/types";
import { money, date, cashMoney } from "@/lib/format";
import styles from "./Accounts.module.css";
const amount = (value: Parameters<typeof money>[0]) => (
  <PrivateValue placeholder="••••">{money(value)}</PrivateValue>
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
              Value
            </th>
            <th scope="col">Cash / buying power</th>
            <th scope="col">Last synced</th>
          </tr>
        </thead>
        {accounts.map((a) => {
          const totals = accountCurrencyTotals(a);
          return (
            <tbody
              key={a.account.id}
              id={`account-${a.account.id}`}
              className={styles.accountGroup}
            >
              <tr className={styles.primaryRow}>
                <td className={styles.identity}>
                  <strong>{a.account.name}</strong>
                  <div className={styles.identityMeta}>
                    <span className={styles.typeBadge}>{a.account.type}</span>
                    <span>{a.account.suffix}</span>
                  </div>
                  <small>{a.account.institution}</small>
                </td>
                <td className={styles.numeric}>
                  <span className={styles.mobileLabel}>Value</span>
                  <strong className={styles.reportedValue}>
                    {amount(a.account.value)}
                  </strong>
                  <small>Reported total</small>
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
                      <PrivateValue placeholder="••••">
                        {a.balances.data
                          .map((b) => cashMoney(b.cash))
                          .join(" · ")}
                      </PrivateValue>
                    )}
                  </div>
                  <small>Buying power in details below</small>
                </td>
                <td>
                  <span className={styles.mobileLabel}>Last synced</span>
                  <time dateTime={a.account.syncedAt || undefined}>
                    {date(a.account.syncedAt)}
                  </time>
                  {a.account.stale && (
                    <small className={styles.warning}>Over 36 hours old</small>
                  )}
                  {a.account.incomplete && (
                    <small className={styles.warning}>
                      Holdings incomplete
                    </small>
                  )}
                </td>
              </tr>
              <tr className={styles.detailRow}>
                <td colSpan={4}>
                  <details className={styles.accountDetails}>
                    <summary>
                      Estimates & buying power <span aria-hidden="true">⌄</span>
                    </summary>
                    <div className={styles.detailGrid}>
                      <section
                        aria-label={`${a.account.name} estimated values`}
                      >
                        <h3>Estimated from holdings</h3>
                        <p>
                          Includes reported cash; native currencies kept
                          separate.
                        </p>
                        <dl>
                          <div>
                            <dt>CAD estimate</dt>
                            <dd>
                              {amount({ amount: totals.cad, currency: "CAD" })}
                            </dd>
                          </div>
                          <div>
                            <dt>USD estimate</dt>
                            <dd>
                              {amount({ amount: totals.usd, currency: "USD" })}
                            </dd>
                          </div>
                        </dl>
                        {totals.incomplete && (
                          <p className={styles.warning}>
                            Partial / stale estimate. Some balances or
                            valuations are unavailable.
                          </p>
                        )}
                        {totals.otherCurrencies.length > 0 && (
                          <p>
                            Other currencies excluded:{" "}
                            {totals.otherCurrencies.join(", ")}.
                          </p>
                        )}
                      </section>
                      <section
                        aria-label={`${a.account.name} cash and buying power`}
                      >
                        <h3>Cash & buying power</h3>
                        {a.balances.status === "error" ? (
                          <p>Balances could not be loaded. Try Refresh.</p>
                        ) : !a.balances.data.length ? (
                          <p>No balances reported.</p>
                        ) : (
                          <dl>
                            {a.balances.data.map((b, i) => (
                              <div key={i} className={styles.balanceDetails}>
                                <dt>
                                  {b.cash.currency || "Unknown currency"} cash
                                </dt>
                                <dd>
                                  <PrivateValue placeholder="••••">
                                    {cashMoney(b.cash)}
                                  </PrivateValue>
                                </dd>
                                <dt>Buying power</dt>
                                <dd>{amount(b.buyingPower)}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        <p>
                          Buying power is shown as reported; it is not added to
                          account value.
                        </p>
                      </section>
                    </div>
                  </details>
                </td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
