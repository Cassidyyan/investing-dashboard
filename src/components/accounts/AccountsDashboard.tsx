"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Portfolio, Result, ExchangeRate } from "@/lib/types";
import {
  NavigationLink,
  NavigationReady,
} from "@/components/layout/NavigationProgress";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { PortfolioLinks } from "@/components/shared/PortfolioLinks";
import { DashboardNavigation } from "@/components/layout/DashboardNavigation";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { AccountsTable } from "./AccountsTable";
import { CurrencyTotal } from "./CurrencyTotal";
import { AllocationBar } from "./AllocationBar";
import shared from "@/styles/dashboard.module.css";
import styles from "./Accounts.module.css";
export type AccountsPreview =
  "sample" | "loading" | "refreshing" | "empty" | "error" | "hidden";
type Props = {
  portfolio: Portfolio;
  rate: Result<ExchangeRate>;
  isLoading?: boolean;
  preview?: AccountsPreview;
};
function AccountsContent({
  portfolio,
  rate,
  isLoading = false,
  preview,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const loading = isLoading || preview === "loading",
    refreshing = pending || preview === "refreshing";
  const refresh = () => startTransition(() => router.refresh());
  const accounts =
    portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const expired =
    portfolio.connections.status === "ok" &&
    portfolio.connections.data.some((c) => c.status === "Disabled");
  const failed = portfolio.accounts.status === "error";
  const partial = accounts.some(
    (a) =>
      a.account.stale ||
      a.account.incomplete ||
      a.balances.status === "error" ||
      a.positions.status === "error",
  );
  return (
    <div className={`${shared.page} ${styles.accountsPage}`}>
      {!loading && <NavigationReady path="/accounts" />}
      <a className={shared.skip} href="#accounts-main">
        Skip to content
      </a>
      <WorkspaceHeader
        updatedAt={portfolio.retrievedAt}
        loading={loading}
        refreshing={refreshing}
        onRefresh={refresh}
      />
      <main id="accounts-main" className={shared.main}>
        <div className={shared.titleRow}>
          <div>
            <h1>Your accounts</h1>
            <p>Brokerage totals first. Estimates when you need them.</p>
          </div>
        </div>
        <DashboardNavigation path="/accounts" />
        <PortfolioLinks path="/accounts" />
        {preview && (
          <aside className={shared.previewBanner}>
            Development preview: {preview}. All figures are invented sample
            data.{" "}
            <NavigationLink href="/accounts">
              Return to live accounts
            </NavigationLink>
          </aside>
        )}
        {!loading && (!portfolio.configured || failed || expired) && (
          <div className={shared.error} role="alert">
            <div>
              <strong>
                {!portfolio.configured
                  ? "Connect your local account"
                  : expired
                    ? "Brokerage connection needs attention"
                    : "We couldn’t load your accounts"}
              </strong>
              <p>
                {!portfolio.configured
                  ? "Configure your existing SnapTrade credentials in .env.local on this machine, then restart the server."
                  : expired
                    ? "Your connection is disabled or expired. Reconnect in SnapTrade, then refresh. Available snapshots may be out of date."
                    : portfolio.accounts.status === "error"
                      ? portfolio.accounts.message
                      : "Try refreshing your accounts."}
              </p>
            </div>
            {expired ? (
              <a
                className={shared.ghostButton}
                href="https://dashboard.snaptrade.com"
                target="_blank"
                rel="noreferrer"
              >
                Reconnect in SnapTrade ↗
              </a>
            ) : (
              <button
                className={shared.ghostButton}
                type="button"
                disabled={refreshing}
                onClick={refresh}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {!loading && partial && (
          <p className={shared.notice}>
            Some balances or holdings are incomplete or stale. Reported totals
            and estimates may reflect different snapshots.
          </p>
        )}
        <div className={shared.srOnly} role="status">
          {loading
            ? "Loading accounts."
            : refreshing
              ? "Refreshing accounts."
              : "Accounts ready."}
        </div>
        <div
          className={`${styles.stack} ${refreshing ? shared.refreshing : ""}`}
          aria-busy={loading || refreshing}
        >
          {loading ? (
            <>
              <section
                className={styles.card}
                aria-label="Loading combined value"
              >
                <div className={`${shared.skeleton} ${shared.skeletonLabel}`} />
                <div className={`${shared.skeleton} ${shared.skeletonValue}`} />
              </section>
              <section className={styles.card} aria-label="Loading accounts">
                <div className={`${shared.skeleton} ${shared.skeletonLabel}`} />
                <div className={styles.loadingRows}>
                  {[0, 1, 2].map((i) => (
                    <div className={shared.skeleton} key={i} />
                  ))}
                </div>
              </section>
              <section
                className={styles.card}
                aria-label="Loading account allocation"
              >
                <div className={`${shared.skeleton} ${shared.skeletonRows}`} />
              </section>
            </>
          ) : accounts.length ? (
            <>
              <CurrencyTotal accounts={accounts} rate={rate} />
              <section
                className={`${styles.card} ${styles.accountsCard}`}
                aria-label="Your investing accounts"
              >
                <div className={styles.cardHeading}>
                  <h2>Investing accounts</h2>
                  <span className={styles.count}>{accounts.length} shown</span>
                </div>
                <AccountsTable accounts={accounts} />
                <p className={styles.footnote}>
                  Reported totals come from your brokerage. Expand an account
                  for holdings-based estimates and buying power.
                </p>
              </section>
              <section className={styles.card} aria-label="Account allocation">
                <div className={styles.cardHeading}>
                  <h2>Account allocation</h2>
                  <span className={styles.count}>Reported totals</span>
                </div>
                <AllocationBar accounts={accounts} />
              </section>
            </>
          ) : (
            !failed && (
              <section className={`${styles.card} ${styles.empty}`}>
                <h2>No investing accounts to show</h2>
                <p>
                  Zero CAD/USD accounts and accounts confirmed to have no open
                  holdings are hidden. Cash-only accounts are listed separately.
                </p>
                <NavigationLink className={shared.ghostButton} href="/cash">
                  View Cash & chequing
                </NavigationLink>
              </section>
            )
          )}
        </div>
        <footer className={shared.footer}>
          Read-only snapshots may lag your brokerage. Updated time does not
          guarantee live prices. No trading or stored brokerage data.
        </footer>
      </main>
    </div>
  );
}
export function AccountsDashboard(props: Props) {
  return props.preview === "hidden" ? (
    <BalancePrivacyProvider initialHidden>
      <AccountsContent {...props} />
    </BalancePrivacyProvider>
  ) : (
    <AccountsContent {...props} />
  );
}
