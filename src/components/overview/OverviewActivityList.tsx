import { NavigationLink } from "@/components/layout/NavigationProgress";
import type { OverviewModel } from "@/lib/overview/overview";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { StatCard } from "@/components/shared/StatCard";
import styles from "@/styles/dashboard.module.css";
import { ActivityIcon } from "@/components/shared/ActivityIcon";
import { date } from "@/lib/format";
export function OverviewActivityList({
  activity,
  message,
}: {
  activity: OverviewModel["activity"];
  message?: string;
}) {
  return (
    <StatCard
      title="Recent activity"
      className={styles.full}
      action={<NavigationLink href="/activity">View all</NavigationLink>}
    >
      {message && (
        <p className={styles.footnote} role="status">
          {message}
        </p>
      )}
      {activity === null ? (
        <p className={styles.empty}>
          Transaction history could not be loaded.{" "}
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
              <ActivityIcon type={a.label} />
              <div>
                <strong title={a.label}>{a.label}</strong>
                <small>{a.account}</small>
              </div>
              <time dateTime={a.date}>{date(a.date)}</time>
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
