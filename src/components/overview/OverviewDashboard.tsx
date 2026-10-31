"use client";
import { SampleNotice } from "@/components/shared/SampleNotice";

import { useState } from "react";
import { useProtectedRefresh } from "@/components/shared/useProtectedRefresh";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { NavigationReady } from "@/components/layout/NavigationProgress";
import { DashboardNavigation } from "@/components/layout/DashboardNavigation";
import { presentOverview, type OverviewModel } from "@/lib/overview/overview";
import type { OverviewPreview } from "@/dev/previews/overview-preview";
import { PortfolioHero } from "./PortfolioHero";
import { AccountList } from "./AccountList";
import { AllocationDonut } from "./AllocationDonut";
import { TopHoldings } from "./TopHoldings";
import { OverviewActivityList } from "./OverviewActivityList";
import { StatCard, CardSkeleton } from "@/components/shared/StatCard";
import { MoneyValue } from "@/components/shared/MoneyValue";
import styles from "@/styles/dashboard.module.css";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
function OverviewContent({
  model,
  preview,
  isLoading = false,
}: {
  model: OverviewModel;
  preview?: OverviewPreview;
  isLoading?: boolean;
}) {
  const { pending, refresh, cooldown } = useProtectedRefresh();
  const [currency, setCurrency] = useState<"CAD" | "USD">("CAD");
  const refreshing = pending || preview === "refreshing";
  const loading = isLoading || preview === "loading";
  const view = presentOverview(model, currency);
  return (
    <div className={styles.page}>
      {!loading && <NavigationReady path="/" />}
      <a className={styles.skip} href="#overview-main">
        Skip to content
      </a>
      <WorkspaceHeader
        updatedAt={model.updatedAt}
        loading={loading}
        refreshing={refreshing}
        refreshBlocked={cooldown}
        onRefresh={refresh}
      />
      <main id="overview-main" className={styles.main}>
        <div className={styles.titleRow}>
          <div>
            <h1>Portfolio overview</h1>
            <p>Your investments, at a glance.</p>
          </div>
        </div>
        <DashboardNavigation path="/" />
        {model.mock && <SampleNotice href="/" />}
        {(model.error || model.expired || !model.configured) && (
          <div className={styles.error} role="alert">
            <div>
              <strong>
                {!model.configured
                  ? "Connect your local account"
                  : model.expired
                    ? "Brokerage connection needs attention"
                    : "We couldn’t update your portfolio"}
              </strong>
              <p>
                {!model.configured
                  ? "Add your existing SnapTrade credentials to .env.local on this machine, then restart the server."
                  : model.error ||
                    "Your brokerage connection has expired or been disabled. Reconnect in SnapTrade, then retry."}
              </p>
            </div>
            {model.expired ? (
              <a
                className={styles.ghostButton}
                href="https://dashboard.snaptrade.com"
                target="_blank"
                rel="noreferrer"
              >
                Reconnect in SnapTrade ↗
              </a>
            ) : (
              <button
                className={styles.ghostButton}
                type="button"
                onClick={refresh}
                disabled={refreshing || cooldown}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {!loading && !model.accounts.length && !model.error && (
          <p className={styles.notice}>
            No investing accounts are available. Review your connected accounts
            under Portfolio; cash-only accounts remain on Cash & chequing.
          </p>
        )}
        {view.partial && !model.error && (
          <p className={styles.notice}>
            Some data is missing, stale, or excluded. Portfolio and allocation
            figures may be partial.
          </p>
        )}
        <div role="status" className={styles.srOnly}>
          {refreshing
            ? "Refreshing portfolio data."
            : loading
              ? "Loading portfolio cards."
              : "Portfolio ready."}
        </div>
        <div
          className={`${styles.grid} ${refreshing ? styles.refreshing : ""}`}
          aria-busy={loading || refreshing}
        >
          {loading ? (
            <>
              <CardSkeleton hero />
              <CardSkeleton />
              <div className={styles.third}>
                <CardSkeleton />
              </div>
              <div className={styles.third}>
                <CardSkeleton />
              </div>
              <div className={styles.third}>
                <CardSkeleton />
              </div>
              <div className={styles.full}>
                <CardSkeleton />
              </div>
            </>
          ) : (
            <>
              <PortfolioHero
                model={model}
                currency={currency}
                onCurrency={setCurrency}
                total={view.total}
                partial={view.partial}
              />
              <StatCard title="Cash balances" className={styles.cash}>
                <p className={styles.footnote}>
                  Total cash · Investing + Cash & chequing
                </p>
                <dl className={styles.cashRows}>
                  {(["CAD", "USD"] as const).map((c) => (
                    <div key={c}>
                      <dt>
                        <span className={styles.currencyLabel}>{c}</span>
                        Available cash
                      </dt>
                      <dd>
                        <MoneyValue amount={model.cash[c]} currency={c} cash />
                      </dd>
                    </div>
                  ))}
                </dl>
                {!!model.cashAccounts?.length && (
                  <ul className={styles.accountCash}>
                    {model.cashAccounts.map((account) => (
                      <li key={account.id}>
                        <span title={account.name}>{account.name}</span>
                        <div>
                          {account.balances.length ? (
                            account.balances.map((value, i) => (
                              <MoneyValue
                                key={i}
                                amount={value.amount}
                                currency={value.currency || ""}
                                cash
                              />
                            ))
                          ) : (
                            <span>Unavailable</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <p className={styles.footnote}>
                  {model.cash.partial
                    ? "Some cash balances are unavailable or stale."
                    : "Cash is shown in its original currency."}
                </p>
              </StatCard>
              <AccountList model={model} currency={currency} />
              <AllocationDonut rows={view.allocation} partial={view.partial} />
              <TopHoldings rows={view.holdings} currency={currency} />
              <OverviewActivityList
                activity={model.activity}
                message={model.activityMessage}
              />
            </>
          )}
        </div>
        <footer className={styles.footer}>
          Read-only snapshots may lag your brokerage. Refresh time does not
          guarantee live prices. No trading or stored brokerage data.
        </footer>
      </main>
    </div>
  );
}
export function OverviewDashboard(props: {
  model: OverviewModel;
  preview?: OverviewPreview;
  isLoading?: boolean;
}) {
  return props.preview === "hidden" ? (
    <BalancePrivacyProvider initialHidden>
      <OverviewContent {...props} />
    </BalancePrivacyProvider>
  ) : (
    <OverviewContent {...props} />
  );
}
