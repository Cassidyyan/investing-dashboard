"use client";

// Shared page controls use the same scoped design tokens as Overview.
import { NavigationLink } from "./NavigationProgress";
import { useBalancePrivacy } from "@/components/shared/BalancePrivacy";
import { StatusChip } from "@/components/shared/StatusChip";
import styles from "@/components/overview/Overview.module.css";
export function WorkspaceHeader({
  updatedAt,
  loading = false,
  refreshing = false,
  onRefresh: refresh,
}: {
  updatedAt: string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh: () => void;
}) {
  const { hidden, toggle } = useBalancePrivacy();
  return (
    <header className={styles.topbar}>
      <NavigationLink href="/" className={styles.brand}>
        <span aria-hidden="true">h</span>holdings
      </NavigationLink>
      <div className={styles.toolbar}>
        <StatusChip updatedAt={updatedAt} loading={loading} />
        <button
          type="button"
          className={styles.ghostButton}
          aria-pressed={hidden}
          onClick={toggle}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {hidden && <path d="m3 3 18 18" />}
          </svg>
          {hidden ? "Show balances" : "Hide balances"}
        </button>
        <button
          type="button"
          className={styles.ghostButton}
          disabled={refreshing || loading}
          onClick={refresh}
        >
          <svg
            className={refreshing ? styles.spinner : ""}
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5" />
          </svg>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </header>
  );
}
