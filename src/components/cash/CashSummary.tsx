import type { AccountData } from "@/lib/types";
import { cashSummary } from "@/lib/cash/cash";
import { StatCard } from "@/components/shared/StatCard";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { CurrencyToggle } from "@/components/shared/CurrencyToggle";
import { InfoPopover } from "@/components/shared/InfoPopover";
import styles from "./Cash.module.css";
export function CashSummary({
  accounts,
  currency,
  onCurrency,
}: {
  accounts: AccountData[];
  currency: "CAD" | "USD";
  onCurrency: (value: "CAD" | "USD") => void;
}) {
  const summary = cashSummary(accounts),
    other = currency === "CAD" ? "USD" : "CAD";
  return (
    <StatCard
      title="Total cash"
      className={styles.summary}
      action={
        <div className={styles.summaryControls}>
          <CurrencyToggle
            value={currency}
            onChange={onCurrency}
            label="Cash summary currency"
          />
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
              reported totals or buying power. CAD and USD stay separate; this
              toggle does not convert currencies. Other currencies remain
              visible in the account list.
            </p>
          </InfoPopover>
        </div>
      }
    >
      <div className={styles.summaryGrid}>
        <div>
          <span className={styles.label}>Cash held in {currency}</span>
          <p className={styles.heroValue}>
            <MoneyValue
              amount={summary.totals[currency]}
              currency={currency}
              cash
            />
          </p>
          <p className={styles.footnote}>
            Native balance · no currency conversion
          </p>
        </div>
        <dl className={styles.summaryStats}>
          <div>
            <dt>Cash held in {other}</dt>
            <dd>
              <MoneyValue
                amount={summary.totals[other]}
                currency={other}
                cash
              />
            </dd>
          </div>
          <div>
            <dt>Cash accounts shown</dt>
            <dd>{summary.count}</dd>
          </div>
        </dl>
      </div>
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
