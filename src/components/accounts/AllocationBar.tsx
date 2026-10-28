import { PrivateValue } from "@/components/shared/BalancePrivacy";
import type { AccountData } from "@/lib/types";
import { money } from "@/lib/format";
import styles from "./Accounts.module.css";
export function AllocationBar({ accounts }: { accounts: AccountData[] }) {
  const groups = new Map<string, AccountData[]>();
  for (const a of accounts) {
    const v = a.account.value;
    if (v.currency && v.amount !== null && v.amount >= 0)
      groups.set(v.currency, [...(groups.get(v.currency) || []), a]);
  }
  return (
    <>
      {[...groups].map(([currency, rows]) => {
        const total = rows.reduce(
          (s, a) => s + (a.account.value.amount || 0),
          0,
        );
        return (
          <section
            key={currency}
            className={styles.allocationGroup}
            aria-label={`${currency} account allocation`}
          >
            <h3>{currency} · reported totals</h3>
            <ul>
              {rows.map((a, i) => {
                const percent =
                  total > 0 ? ((a.account.value.amount || 0) / total) * 100 : 0;
                return (
                  <li key={a.account.id}>
                    <div className={styles.allocationLabel}>
                      <span>{a.account.name}</span>
                      <span className={styles.allocationPercent}>
                        <PrivateValue placeholder="••••">
                          {percent.toFixed(1)}%
                        </PrivateValue>
                      </span>
                      <strong>
                        <PrivateValue placeholder="••••">
                          {money(a.account.value)}
                        </PrivateValue>
                      </strong>
                    </div>
                    <div className={styles.track} aria-hidden="true">
                      <div
                        style={{
                          width: `${percent}%`,
                          background: `var(--account-teal-${i % 4})`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {!groups.size && (
        <p className={styles.empty}>Allocation is unavailable.</p>
      )}
      <p className={styles.footnote}>
        Share of available non-negative reported totals within each currency.
        Missing and negative totals excluded; no conversion.
      </p>
    </>
  );
}
