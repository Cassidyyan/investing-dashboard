import { NavigationLink } from "@/components/layout/NavigationProgress";
import type { OverviewModel } from "@/lib/overview/overview";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { StatCard } from "@/components/shared/StatCard";
import styles from "@/styles/dashboard.module.css";
export function OverviewActivityList({
  activity,
}: {
  activity: OverviewModel["activity"];
}) {
  return (
    <StatCard
      title="Recent activity"
      className={styles.full}
      action={<NavigationLink href="/activity">View all</NavigationLink>}
    >
      {activity === null ? (
        <p className={styles.empty}>
          Transactions are not loaded on Overview.{" "}
          <NavigationLink href="/activity">Open Activity</NavigationLink> to
          view your recent records.
        </p>
      ) : !activity.length ? (
        <p className={styles.empty}>
          No recent activity to show. New transactions will appear after your
          brokerage syncs.
        </p>
      ) : (
        <ul className={styles.activityList}>
          {activity.slice(0, 5).map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.label}</strong>
                <small>{a.account}</small>
              </div>
              <time dateTime={a.date}>{a.date}</time>
              <b>
                <MoneyValue
                  amount={a.value.amount}
                  currency={a.value.currency || "CAD"}
                />
              </b>
            </li>
          ))}
        </ul>
      )}
    </StatCard>
  );
}
