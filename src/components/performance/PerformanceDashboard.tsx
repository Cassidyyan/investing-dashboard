"use client";
import { SampleNotice } from "@/components/shared/SampleNotice";
import { Select } from "@/components/shared/Select";
import { useState } from "react";
import { useProtectedRefresh } from "@/components/shared/useProtectedRefresh";
import type { PerformanceAccount, Portfolio } from "@/lib/types";
import {
  aggregateHistory,
  historyRanges,
  selectHistoryRange,
  type HistoryRange,
} from "@/lib/performance/performance";
import { aggregateFunding } from "@/lib/performance/cash-flow-returns";
import { historyDay } from "@/lib/performance/presentation";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { DashboardNavigation } from "@/components/layout/DashboardNavigation";
import { NavigationReady } from "@/components/layout/NavigationProgress";
import { PortfolioLinks } from "@/components/shared/PortfolioLinks";
import { CurrencyToggle } from "@/components/shared/CurrencyToggle";
import { RangeToggle } from "@/components/shared/RangeToggle";
import { StatCard } from "@/components/shared/StatCard";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { PerformanceHero } from "./PerformanceHero";
import { AccountPerformanceList } from "./AccountPerformanceList";
import { ReportedReturnsCard } from "./ReportedReturnsCard";
import { SetupBanner } from "./SetupBanner";
import { HistoryCoverage } from "@/components/shared/HistoryCoverage";
import shared from "@/styles/dashboard.module.css";
import styles from "./Performance.module.css";
export type PerformancePreview =
  | "sample"
  | "empty"
  | "error"
  | "loading"
  | "refreshing"
  | "hidden"
  | "single"
  | "mixed"
  | "reported";
type Props = {
  accounts: PerformanceAccount[];
  today: string;
  portfolio?: Portfolio;
  isLoading?: boolean;
  preview?: PerformancePreview;
};
function PerformanceContent({
  accounts,
  today,
  portfolio,
  isLoading = false,
  preview,
}: Props) {
  const { pending, refresh, cooldown } = useProtectedRefresh();
  const [range, setRange] = useState<HistoryRange>("1M"),
    [accountId, setAccountId] = useState("all"),
    [chosenCurrency, setCurrency] = useState<"CAD" | "USD">("CAD");
  const refreshing = pending || preview === "refreshing",
    loading = isLoading || preview === "loading";
  const selected =
    accountId === "all" ? accounts : accounts.filter((a) => a.id === accountId);
  const groups = aggregateHistory(selected),
    currency = groups.some((g) => g.currency === chosenCurrency)
      ? chosenCurrency
      : groups[0]?.currency || "CAD";
  const group = groups.find((g) => g.currency === currency),
    points = group ? selectHistoryRange(group.points, range, today) : [];
  const through =
    group?.points.filter((p) => p.date <= today).at(-1)?.date ||
    selected
      .flatMap((a) =>
        a.history.status === "ok" && a.history.data.currency === currency
          ? a.history.data.points
              .filter((p) => p.date <= today)
              .map((p) => p.date)
          : [],
      )
      .sort()
      .at(-1);
  const expired =
    portfolio?.connections.status === "ok" &&
    portfolio.connections.data.some((c) => c.status === "Disabled");
  const failed = portfolio?.accounts.status === "error",
    configured = portfolio?.configured ?? true;
  const messages = selected.flatMap((a) =>
    a.history.status === "error"
      ? [a.history.message]
      : !a.history.data.points.length
        ? [`${a.name} has no observed historical snapshots.`]
        : [],
  );
  const omittedPoints = selected.reduce(
    (sum, a) =>
      sum + (a.history.status === "ok" ? a.history.data.omittedPoints : 0),
    0,
  );
  if (
    !selected.some(
      (a) =>
        a.returns.status === "ok" &&
        a.returns.data.some((r) =>
          ["1D", "1M", "YTD", "1Y"].includes(r.timeframe),
        ),
    )
  )
    messages.push(
      "No brokerage-reported returns are available for the selected accounts.",
    );
  const rangeOptions = historyRanges
    .filter((r) => r !== "5 Year")
    .map((r) => ({ value: r, label: r === "1 Year" ? "1Y" : r }));
  return (
    <div className={`${shared.page} ${styles.page}`}>
      {!loading && <NavigationReady path="/performance" />}
      <a className={shared.skip} href="#performance-main">
        Skip to content
      </a>
      <WorkspaceHeader
        updatedAt={portfolio?.retrievedAt || `${today}T12:00:00Z`}
        dataThrough={through ? historyDay(through) : "Unavailable"}
        onRefresh={refresh}
        refreshing={refreshing}
        refreshBlocked={cooldown}
        loading={loading}
      />
      <main id="performance-main" className={shared.main}>
        <div className={shared.titleRow}>
          <div>
            <h1>Your portfolio over time</h1>
            <p>Observed account values, with the detail behind each change.</p>
          </div>
        </div>
        <DashboardNavigation path="/performance" />
        <PortfolioLinks path="/performance" group="performance" />
        {preview && <SampleNotice href="/performance" />}
        {!loading && (!configured || failed || expired) && (
          <div className={shared.error} role="alert">
            <div>
              <strong>
                {expired
                  ? "Brokerage connection needs attention"
                  : !configured
                    ? "Connect your local account"
                    : "Account history could not load"}
              </strong>
              <p>
                {expired
                  ? "Reconnect your brokerage in SnapTrade and refresh."
                  : portfolio?.accounts.status === "error"
                    ? portfolio.accounts.message
                    : "Configure your existing credentials locally in .env.local."}
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
                type="button"
                className={shared.ghostButton}
                onClick={refresh}
                disabled={refreshing || cooldown}
              >
                Retry
              </button>
            )}
          </div>
        )}
        <div
          className={refreshing ? shared.refreshing : undefined}
          aria-busy={loading || refreshing}
        >
          {loading ? (
            <div className={styles.cards}>
              {[
                "Loading account value",
                "Loading account performance",
                "Loading brokerage returns",
              ].map((title, i) => (
                <StatCard key={title} title={title}>
                  {i === 0 && (
                    <div
                      className={`${shared.skeleton} ${shared.skeletonValue}`}
                    />
                  )}
                  <div
                    className={`${shared.skeleton} ${i === 0 ? styles.chartSkeleton : styles.rowSkeleton}`}
                  />
                </StatCard>
              ))}
            </div>
          ) : (
            <>
              <section
                className={styles.controls}
                aria-label="Performance controls"
              >
                <label className={styles.accountLabel}>
                  Account
                  <span className={styles.accountSelect}>
                    <Select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      <option value="all">All accounts</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} {a.suffix}
                        </option>
                      ))}
                    </Select>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="m7 10 5 5 5-5" />
                    </svg>
                  </span>
                </label>
                {groups.some((g) => g.currency === "CAD") &&
                  groups.some((g) => g.currency === "USD") && (
                    <CurrencyToggle
                      value={currency as "CAD" | "USD"}
                      onChange={setCurrency}
                      label="History currency"
                    />
                  )}
                <div className={styles.ranges}>
                  <RangeToggle
                    value={range}
                    onChange={setRange}
                    options={rangeOptions}
                    label="Historical date range"
                  />
                </div>
              </section>
              <SetupBanner
                messages={messages}
                onRetry={refresh}
                refreshing={refreshing || cooldown}
              />
              <div className={styles.cards}>
                <HistoryCoverage
                  rows={selected.flatMap((a) => {
                    const data =
                      a.funding?.status === "ok"
                        ? a.funding.data
                        : a.funding?.partialData;
                    return data?.coverage
                      ? [
                          {
                            label: a.name,
                            coverage: data.coverage,
                            sync:
                              portfolio?.accounts.status === "ok"
                                ? portfolio.accounts.data.find(
                                    (row) => row.account.id === a.id,
                                  )?.account.transactionSync
                                : undefined,
                          },
                        ]
                      : [];
                  })}
                />
                {points.length ? (
                  <PerformanceHero
                    key={`${accountId}-${currency}-${range}`}
                    points={points}
                    currency={currency}
                    funding={aggregateFunding(selected, currency)}
                    accountCount={group!.accountCount}
                    missingDates={group!.missingDates}
                    omittedPoints={omittedPoints}
                  />
                ) : (
                  <StatCard title="Historical performance">
                    <div className={styles.empty}>
                      <h3>No observed values in this selection</h3>
                      <p>
                        Select another account, currency or range. If history is
                        missing, check source access and refresh.
                      </p>
                      <button
                        className={shared.ghostButton}
                        type="button"
                        onClick={refresh}
                        disabled={refreshing || cooldown}
                      >
                        Retry history
                      </button>
                      <a
                        href="https://dashboard.snaptrade.com"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Check history access ↗
                      </a>
                    </div>
                  </StatCard>
                )}
                <AccountPerformanceList
                  accounts={selected}
                  portfolio={portfolio}
                  currency={currency}
                  range={range}
                  today={today}
                />
                <ReportedReturnsCard accounts={selected} />
              </div>
            </>
          )}
        </div>
        <p className={styles.srOnly} role="status">
          {loading
            ? "Loading performance."
            : refreshing
              ? "Refreshing performance."
              : "Performance ready."}
        </p>
        <footer className={shared.footer}>
          Estimated daily values · no historical FX conversion. No trading or
          stored brokerage data.
        </footer>
      </main>
    </div>
  );
}
export function PerformanceDashboard(props: Props) {
  return props.preview === "hidden" ? (
    <BalancePrivacyProvider initialHidden>
      <PerformanceContent {...props} />
    </BalancePrivacyProvider>
  ) : (
    <PerformanceContent {...props} />
  );
}
