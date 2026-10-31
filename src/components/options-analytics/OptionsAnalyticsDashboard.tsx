"use client";
import { useMemo, useState } from "react";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { DashboardNavigation } from "@/components/layout/DashboardNavigation";
import {
  NavigationLink,
  NavigationReady,
} from "@/components/layout/NavigationProgress";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { SampleNotice } from "@/components/shared/SampleNotice";
import { CardSkeleton } from "@/components/shared/StatCard";
import { useProtectedRefresh } from "@/components/shared/useProtectedRefresh";
import { optionsAnalytics } from "@/lib/options/analytics";
import type {
  OptionsData,
  OptionsFilters as Filters,
} from "@/lib/options/analytics-types";
import { OptionsFilters } from "./OptionsFilters";
import { OptionsSummary } from "./OptionsSummary";
import { OptionsCharts } from "./OptionsCharts";
import { UnderlyingPerformance } from "./UnderlyingPerformance";
import { TradeJournal } from "./TradeJournal";
import { OptionsCoverage } from "./OptionsCoverage";
import { ImportPreview } from "./ImportPreview";
import { ImportReconciliationNotice } from "@/components/shared/ImportReconciliationNotice";
import { OPTIONS_CURRENCY } from "@/lib/options/currency";
import shared from "@/styles/dashboard.module.css";
import styles from "./OptionsAnalytics.module.css";
export function OptionsAnalyticsDashboard({
  data,
  preview,
  isLoading = false,
}: {
  data: OptionsData;
  preview?: string;
  isLoading?: boolean;
}) {
  if (preview === "hidden")
    return (
      <BalancePrivacyProvider initialHidden>
        <Dashboard data={data} preview={preview} isLoading={isLoading} />
      </BalancePrivacyProvider>
    );
  return <Dashboard data={data} preview={preview} isLoading={isLoading} />;
}
function Dashboard({
  data,
  preview,
  isLoading,
}: {
  data: OptionsData;
  preview?: string;
  isLoading: boolean;
}) {
  const [selection, setSelection] = useState<Filters>({
    account: "all",
    ticker: "all",
    currency: OPTIONS_CURRENCY,
    from: "",
    to: "",
    right: "all",
    status: "all",
  });
  const filters = useMemo(
    () => ({ ...selection, currency: OPTIONS_CURRENCY }),
    [selection],
  );
  const setFilters = (next: Filters) =>
    setSelection({ ...next, currency: OPTIONS_CURRENCY });
  const stats = useMemo(() => optionsAnalytics(data, filters), [data, filters]);
  const { pending, refresh, cooldown } = useProtectedRefresh();
  const positions = data.openPositions.filter(
    (p) =>
      (filters.account === "all" || p.accountId === filters.account) &&
      (filters.ticker === "all" || p.ticker === filters.ticker) &&
      p.currency === filters.currency &&
      (filters.right === "all" || p.right === filters.right),
  );
  return (
    <div className={shared.page}>
      {!isLoading && <NavigationReady path="/options-analytics" />}
      <a href="#options-main" className={shared.skip}>
        Skip to options analytics
      </a>
      <WorkspaceHeader
        updatedAt={data.updatedAt}
        loading={isLoading}
        refreshing={pending}
        refreshBlocked={cooldown}
        onRefresh={refresh}
      />
      <main
        id="options-main"
        className={`${shared.main} ${styles.main}`}
        aria-busy={pending || isLoading}
      >
        <div className={shared.pageHeading}>
          <h1>Options Analytics</h1>
          <p>
            Your option cash flows, closed trades, and the evidence behind them.
          </p>
        </div>
        <DashboardNavigation path="/options-analytics" />
        {preview && <SampleNotice href="/options-analytics" />}
        {isLoading ? (
          <>
            <p role="status">Loading options analytics…</p>
            <div className={styles.kpis}>
              {Array.from({ length: 4 }, (_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            <div className={styles.charts}>
              <CardSkeleton hero />
              <CardSkeleton />
            </div>
            <CardSkeleton />
          </>
        ) : (
          <div className={pending ? styles.refreshing : undefined}>
            {data.error && (
              <div className={shared.error} role="alert">
                <div>
                  <strong>
                    {data.reconnect
                      ? "Reconnect your brokerage"
                      : "Options data unavailable"}
                  </strong>
                  <p>{data.error}</p>
                  <a href="https://dashboard.snaptrade.com/">
                    Manage SnapTrade connection
                  </a>
                </div>
                <button
                  type="button"
                  className={shared.ghostButton}
                  disabled={pending || cooldown}
                  onClick={refresh}
                >
                  Retry options history
                </button>
              </div>
            )}
            {!data.error && data.reconnect && (
              <p className={shared.notice} role="status">
                Your connection is disabled; cached data is excluded from
                realized performance.{" "}
                <a href="https://dashboard.snaptrade.com/">Manage connection</a>
                .
              </p>
            )}
            {data.importPreview && (
              <ImportPreview
                data={data.importPreview}
                reconciliation={data.importReconciliation}
              />
            )}
            <ImportReconciliationNotice report={data.importReconciliation} />
            <OptionsFilters data={data} value={filters} onChange={setFilters} />
            {filters.from && filters.to && filters.from > filters.to ? (
              <p role="alert">
                Choose a From date on or before the Through date.
              </p>
            ) : (
              <>
                {(stats.excluded > 0 || data.issues.length > 0) && (
                  <p className={shared.notice} role="status">
                    Partial coverage · {stats.excluded} lifecycles/events need
                    review. Metrics cover evaluable records only; read the
                    reconciliation notes below.
                  </p>
                )}
                {stats.otherCurrencies.length > 0 && (
                  <p className={shared.notice}>
                    Other native currencies ({stats.otherCurrencies.join(", ")})
                    are retained but excluded from CAD/USD views.
                  </p>
                )}
                {!data.error && !data.trades.length && (
                  <p className={shared.notice}>
                    No historical options activity is available. Current
                    positions, when supplied, are shown separately.{" "}
                    <NavigationLink href="/holdings">
                      View Holdings & options
                    </NavigationLink>
                    .
                  </p>
                )}
                <OptionsSummary
                  stats={stats}
                  currency={filters.currency}
                  openCount={positions.length}
                  csvSource={data.importReconciliation?.optionsSource === "csv"}
                />
                <OptionsCharts stats={stats} currency={filters.currency} />
                <UnderlyingPerformance
                  stats={stats}
                  currency={filters.currency}
                  onSelect={(ticker) => setFilters({ ...filters, ticker })}
                />
                <TradeJournal trades={stats.journal} accounts={data.accounts} />
                <OptionsCoverage data={data} filters={filters} />
              </>
            )}
          </div>
        )}
        <footer className={shared.footer}>
          Read-only activity snapshots may lag. No trading. Optional CSV exports
          stay local and git-ignored. Premium is not realized profit; entry
          Greeks and automatic strategy classification are unavailable.
        </footer>
      </main>
    </div>
  );
}
