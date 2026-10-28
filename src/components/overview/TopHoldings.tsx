import { NavigationLink } from "@/components/layout/NavigationProgress";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { StatCard } from "@/components/shared/StatCard";
import styles from "@/styles/dashboard.module.css";
import { SecurityIcon } from "@/components/shared/SecurityIcon";
export function TopHoldings({
  rows,
  currency,
}: {
  rows: { label: string; value: number; logoUrl?: string | null }[];
  currency: string;
}) {
  return (
    <StatCard
      title="Top holdings"
      className={styles.third}
      action={<NavigationLink href="/holdings">View all</NavigationLink>}
    >
      <p className={styles.footnote}>
        Largest positive positions by market value
      </p>
      {rows.length ? (
        <ol className={styles.holdingsList}>
          {rows.map((r, index) => (
            <li key={r.label}>
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.holdingIcon}>
                <SecurityIcon symbol={r.label} logoUrl={r.logoUrl ?? null} />
              </span>
              <strong title={r.label}>{r.label}</strong>
              <b>
                <MoneyValue amount={r.value} currency={currency} />
              </b>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.empty}>No valued holdings to display.</p>
      )}
    </StatCard>
  );
}
