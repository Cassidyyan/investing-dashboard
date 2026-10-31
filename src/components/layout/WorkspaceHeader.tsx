"use client";

// Shared page controls use the same scoped design tokens as Overview.
import { NavigationLink } from "./NavigationProgress";
import { BalanceVisibilityToggle } from "@/components/shared/BalancePrivacy";
import { StatusChip } from "@/components/shared/StatusChip";
import styles from "@/styles/dashboard.module.css";
export function WorkspaceHeader({
  updatedAt,
  loading = false,
  refreshing = false,
  refreshBlocked = false,
  dataThrough,
  onRefresh: refresh,
}: {
  updatedAt: string;
  loading?: boolean;
  refreshing?: boolean;
  refreshBlocked?: boolean;
  dataThrough?: string | null;
  onRefresh: () => void;
}) {
  return (
    <header className={styles.topbar}>
      <NavigationLink href="/" className={styles.brand}>
        <span aria-hidden="true">h</span>holdings
      </NavigationLink>
      <div className={styles.toolbar}>
        <StatusChip
          updatedAt={updatedAt}
          loading={loading}
          dataThrough={dataThrough}
        />
        <BalanceVisibilityToggle className={styles.ghostButton} />
        <button
          type="button"
          className={styles.ghostButton}
          disabled={refreshing || loading || refreshBlocked}
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
          {refreshing
            ? "Refreshing…"
            : refreshBlocked
              ? "Refresh available shortly"
              : "Refresh"}
        </button>
      </div>
    </header>
  );
}
