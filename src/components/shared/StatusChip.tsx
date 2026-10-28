import styles from "@/styles/dashboard.module.css";
export function StatusChip({
  updatedAt,
  loading = false,
}: {
  updatedAt: string;
  loading?: boolean;
}) {
  const updated = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(updatedAt));
  return (
    <div className={styles.status}>
      <span className={styles.readOnly}>
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <rect x="3" y="7" width="10" height="7" rx="2" />
          <path d="M5 7V5a3 3 0 0 1 6 0v2" />
        </svg>
        Read-only
      </span>
      <span>{loading ? "Loading portfolio…" : `Updated ${updated} ET`}</span>
    </div>
  );
}
