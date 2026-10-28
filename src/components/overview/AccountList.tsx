import { NavigationLink } from "@/components/layout/NavigationProgress";
import {
  convertOverview,
  convertOverviewChange,
  type OverviewModel,
} from "@/lib/overview/overview";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { ChangeBadge } from "@/components/shared/ChangeBadge";
import { StatCard } from "@/components/shared/StatCard";
import styles from "@/styles/dashboard.module.css";
export function AccountList({
  model,
  currency,
}: {
  model: OverviewModel;
  currency: "CAD" | "USD";
}) {
  return (
    <StatCard title="Your accounts" className={styles.third}>
      {model.accounts.length ? (
        <ul className={styles.accountList}>
          {model.accounts.map((a) => (
            <li key={a.id}>
              <NavigationLink
                href={`/accounts#account-${encodeURIComponent(a.id)}`}
              >
                <div className={styles.rowSpread}>
                  <strong>{a.name}</strong>
                  <b>
                    <MoneyValue
                      amount={convertOverview(a.value, currency, model.rate)}
                      currency={currency}
                    />
                  </b>
                </div>
                <div className={styles.rowSpread}>
                  <small>Day change</small>
                  <ChangeBadge
                    change={convertOverviewChange(
                      a.dayChange,
                      a.value.currency,
                      currency,
                      model.rate,
                    )}
                    currency={currency}
                  />
                </div>
              </NavigationLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          No investing accounts to display. Check your connected accounts in
          Portfolio.
        </p>
      )}
    </StatCard>
  );
}
