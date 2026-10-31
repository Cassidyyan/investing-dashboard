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
import { CsvUpload } from "./CsvUpload";
import { useAppSettings } from "@/components/shared/AppSettings";
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
  const [uploaded, setUploaded] = useState<OptionsData | null>(null);
  const effective = uploaded
    ? {
        ...uploaded,
        openPositions: preview ? [] : data.openPositions,
        accounts: [
          ...uploaded.accounts,
          ...(preview
            ? []
            : data.accounts.filter((a) => !a.id.startsWith("csv-account-"))),
        ],
        snapshotError: preview
          ? "Current brokerage positions are not loaded in the sample view."
          : data.error ||
            data.snapshotError ||
            (data.reconnect
              ? "The brokerage connection is disabled; current positions may be stale."
              : null),
      }
    : data;
  const dashboard = (
    <Dashboard
      data={effective}
      preview={uploaded ? undefined : preview}
      isLoading={isLoading}
      onImport={setUploaded}
      onRemove={
        uploaded
          ? () => {
              setUploaded(null);
              return data;
            }
          : undefined
      }
    />
  );
  return preview === "hidden" ? (
    <BalancePrivacyProvider initialHidden>{dashboard}</BalancePrivacyProvider>
  ) : (
    dashboard
  );
}

function Dashboard({
  data,
  preview,
  isLoading,
  onImport,
  onRemove,
}: {
  onImport: (data: OptionsData) => void;
  onRemove?: () => OptionsData;
  data: OptionsData;
  preview?: string;
  isLoading: boolean;
}) {
  const { optionsCurrency, demo } = useAppSettings();
  const defaultCurrency =
    optionsCurrency === "USD"
      ? "USD"
      : data.trades.find((t) => t.currency)?.currency || "USD";
  const [selection, setSelection] = useState<Filters>({
    account: "all",
    ticker: "all",
    currency: defaultCurrency,
    from: "",
    to: "",
    right: "all",
    status: "all",
  });
  const filters = useMemo(
    () =>
      optionsCurrency === "USD" ? { ...selection, currency: "USD" } : selection,
    [selection, optionsCurrency],
  );
  const setFilters = (next: Filters) =>
    setSelection(
      optionsCurrency === "USD" ? { ...next, currency: "USD" } : next,
    );
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
            <CsvUpload
              onImport={(next) => {
                setSelection({
                  account: "all",
                  ticker: "all",
                  currency:
                    optionsCurrency === "USD"
                      ? "USD"
                      : next.trades.find((t) => t.currency)?.currency || "USD",
                  from: "",
                  to: "",
                  right: "all",
                  status: "all",
                });
                onImport(next);
              }}
              onRemove={
                onRemove
                  ? () => {
                      const original = onRemove();
                      setSelection({
                        account: "all",
                        ticker: "all",
                        currency:
                          optionsCurrency === "USD"
                            ? "USD"
                            : original.trades.find((t) => t.currency)
                                ?.currency || "USD",
                        from: "",
                        to: "",
                        right: "all",
                        status: "all",
                      });
                    }
                  : undefined
              }
            />
            {data.historySource === "csv" && (
              <aside className={shared.notice} aria-label="CSV primary source">
                <strong>History source: Wealthsimple CSV</strong>
                <p>
                  Historical analytics use CSV activity only. SnapTrade history
                  is not merged or counted again. Export coverage does not prove
                  lifetime completeness. CSV accounts are aliases and are not
                  automatically linked to current brokerage accounts.
                </p>
                {data.snapshotError && (
                  <p>{data.snapshotError} CSV history remains available.</p>
                )}
              </aside>
            )}
            {data.importPreview && !demo && (
              <ImportPreview
                data={data.importPreview}
                reconciliation={data.importReconciliation}
                primary={data.historySource === "csv"}
                temporary={!!onRemove}
              />
            )}
            {data.historySource !== "csv" && (
              <ImportReconciliationNotice report={data.importReconciliation} />
            )}
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
                    stay separate from the selected currency. Change the
                    currency filter to view them.
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
          on disk stay local and git-ignored; uploads are temporary. Premium is
          not realized profit; entry Greeks and automatic strategy
          classification are unavailable.
        </footer>
      </main>
    </div>
  );
}
