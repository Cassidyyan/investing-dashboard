import type { AccountData } from "@/lib/types";
import { cashSummary } from "@/lib/cash/cash";
import { StatCard } from "@/components/shared/StatCard";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { InfoPopover } from "@/components/shared/InfoPopover";
import styles from "./Cash.module.css";
export function CashSummary({ accounts }: { accounts: AccountData[] }) {
  const summary = cashSummary(accounts);
  return (
    <StatCard
      title="Total cash"
      className={styles.summary}
      action={
        <div className={styles.summaryControls}>
          <span className={styles.label}>{summary.count} accounts</span>
          <InfoPopover label="About cash accounts and summary totals">
            <p>
              Banking accounts identified by the brokerage and accounts
              confirmed to have no open holdings appear here. Cash-only
              investing accounts use your personal HYSA label, with an assumed
              higher yield than chequing. Actual rates are not supplied by this
              data, so no interest earnings are calculated.
            </p>
            <p>
              These accounts are excluded from investing totals. Accounts
              reporting exactly 0 CAD or 0 USD are hidden.
            </p>
            <p>
              Cash subtotals use reported cash balances, not account-level
              reported totals or buying power. CAD and USD stay separate; the
              summary does not convert currencies. Other currencies remain
              visible in the account list.
            </p>
          </InfoPopover>
        </div>
      }
    >
      <div className={styles.summaryGrid}>
        {(["CAD", "USD"] as const).map((currency) => (
          <div key={currency}>
            <span className={styles.label}>Cash held in {currency}</span>
            <p className={styles.heroValue}>
              <MoneyValue
                amount={summary.totals[currency]}
                currency={currency}
                cash
              />
            </p>
          </div>
        ))}
      </div>
      <p className={styles.footnote}>
        Native balances · no currency conversion
      </p>
      {summary.partial && (
        <p className={styles.notice}>
          Partial or stale cash subtotals. Some balances are unavailable
          {summary.otherCurrencies.length
            ? `; excludes ${summary.otherCurrencies.join(", ")}`
            : ""}
          .
        </p>
      )}
    </StatCard>
  );
}
