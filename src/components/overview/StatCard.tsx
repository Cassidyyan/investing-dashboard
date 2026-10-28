import type { ReactNode } from "react";
import styles from "./Overview.module.css";
export function StatCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${className}`} aria-label={title}>
      <div className={styles.cardHeading}>
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function CardSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <section
      className={`${styles.card} ${hero ? styles.hero : ""}`}
      aria-label="Loading card"
    >
      <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
      <div className={`${styles.skeleton} ${styles.skeletonValue}`} />
      <div
        className={`${styles.skeleton} ${hero ? styles.skeletonChart : styles.skeletonRows}`}
      />
    </section>
  );
}
