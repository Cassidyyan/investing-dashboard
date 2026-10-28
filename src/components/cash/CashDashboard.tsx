"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Portfolio } from "@/lib/types";
import { cashFigureReview, cashSyncInfo } from "@/lib/cash/cash";
import {
  NavigationLink,
  NavigationReady,
} from "@/components/layout/NavigationProgress";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { PortfolioLinks } from "@/components/shared/PortfolioLinks";
import { DashboardNavigation } from "@/components/layout/DashboardNavigation";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { StatCard } from "@/components/shared/StatCard";
import { CashSummary } from "./CashSummary";
import { CashAccountsTable } from "./CashAccountsTable";
import shared from "@/styles/dashboard.module.css";
import accountStyles from "@/components/accounts/Accounts.module.css";
import styles from "./Cash.module.css";
export type CashPreview =
  "sample" | "loading" | "refreshing" | "empty" | "error" | "hidden";
type Props = {
  portfolio: Portfolio;
  isLoading?: boolean;
  preview?: CashPreview;
};
function CashContent({ portfolio, isLoading = false, preview }: Props) {
  const router = useRouter(),
    [pending, startTransition] = useTransition();
  const [currency, setCurrency] = useState<"CAD" | "USD">("CAD");
  const loading = isLoading || preview === "loading",
    refreshing = pending || preview === "refreshing";
  const refresh = () => startTransition(() => router.refresh());
  const accounts =
    portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const sync = cashSyncInfo(accounts, portfolio.retrievedAt);
  const expired =
    portfolio.connections.status === "ok" &&
    portfolio.connections.data.some((c) => c.status === "Disabled");
  const failed = portfolio.accounts.status === "error";
  const differences = accounts.filter(
    (a) => cashFigureReview(a) === "different",
  ).length;
  return (
    <div
      className={`${shared.page} ${accountStyles.accountsPage} ${styles.cashPage}`}
    >
      {!loading && <NavigationReady path="/cash" />}
      <a className={shared.skip} href="#cash-main">
        Skip to content
      </a>
      <WorkspaceHeader
        updatedAt={sync.updatedAt}
        loading={loading}
        refreshing={refreshing}
        onRefresh={refresh}
      />
      <main id="cash-main" className={shared.main}>
        <div className={shared.titleRow}>
          <div>
            <h1>Your cash accounts</h1>
            <p>
              Banking and cash-only balances, kept separate from investments.
            </p>
          </div>
        </div>
        <DashboardNavigation path="/cash" />
        <PortfolioLinks path="/cash" />
        {preview && (
          <aside className={shared.previewBanner}>
            Development preview: {preview}. All figures are invented sample
            data.{" "}
            <NavigationLink href="/cash">
              Return to live cash accounts
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
                    : "We couldn’t load your cash accounts"}
              </strong>
              <p>
                {!portfolio.configured
                  ? "Configure your existing SnapTrade credentials in .env.local on this machine, then restart the server."
                  : expired
                    ? "Reconnect your disabled or expired connection in SnapTrade, then refresh. Available snapshots may be out of date."
                    : portfolio.accounts.status === "error"
                      ? portfolio.accounts.message
                      : "Try Refresh to load your balances."}
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
                disabled={refreshing}
                type="button"
                onClick={refresh}
              >
                Retry
              </button>
            )}
          </div>
        )}
        <div className={shared.srOnly} role="status">
          {loading
            ? "Loading cash accounts."
            : refreshing
              ? "Refreshing cash accounts."
              : "Cash accounts ready."}
        </div>
        <div
          className={`${styles.stack} ${refreshing ? shared.refreshing : ""}`}
          aria-busy={loading || refreshing}
        >
          {loading ? (
            <>
              <StatCard title="Loading cash summary">
                <div className={`${shared.skeleton} ${shared.skeletonValue}`} />
              </StatCard>
              <StatCard title="Loading cash accounts">
                <div className={styles.loadingRows}>
                  {[0, 1, 2].map((i) => (
                    <div className={shared.skeleton} key={i} />
                  ))}
                </div>
              </StatCard>
            </>
          ) : (
            !failed && (
              <>
                <CashSummary
                  accounts={accounts}
                  currency={currency}
                  onCurrency={setCurrency}
                />
                {accounts.length ? (
                  <StatCard
                    title="Cash accounts"
                    className={styles.listCard}
                    action={
                      sync.differing ? (
                        <span className={styles.label}>Sync times vary</span>
                      ) : undefined
                    }
                  >
                    {differences > 0 && (
                      <p className={shared.notice}>
                        {differences}{" "}
                        {differences === 1 ? "account has" : "accounts have"}{" "}
                        different cash and reported figures in the same
                        currency. Values are preserved; see the information
                        beside each reported total.
                      </p>
                    )}
                    <CashAccountsTable
                      accounts={accounts}
                      showSyncTimes={sync.differing}
                    />
                  </StatCard>
                ) : (
                  <StatCard title="No cash accounts to show">
                    <div className={styles.empty}>
                      <p>
                        No visible deposit or cash-only accounts are available.
                        Zero CAD/USD accounts remain hidden.
                      </p>
                      <NavigationLink
                        href="/accounts"
                        className={shared.ghostButton}
                      >
                        View Portfolio accounts
                      </NavigationLink>
                    </div>
                  </StatCard>
                )}
              </>
            )
          )}
        </div>
        <footer className={shared.footer}>
          {sync.common
            ? "Updated reflects the common account sync time."
            : "Updated reflects retrieval; brokerage sync times may differ or be unavailable."}{" "}
          Read-only snapshots may lag. No trading or stored brokerage data.
        </footer>
      </main>
    </div>
  );
}
export function CashDashboard(props: Props) {
  return props.preview === "hidden" ? (
    <BalancePrivacyProvider initialHidden>
      <CashContent {...props} />
    </BalancePrivacyProvider>
  ) : (
    <CashContent {...props} />
  );
}
