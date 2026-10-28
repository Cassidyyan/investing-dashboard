"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Portfolio } from "@/lib/types";
import type { HoldingReturn } from "@/lib/returns/holding-returns";
import {
  isRanked,
  sortReturns,
  type ReturnsSort,
} from "@/lib/returns/presentation";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { DashboardNavigation } from "@/components/layout/DashboardNavigation";
import { NavigationReady } from "@/components/layout/NavigationProgress";
import { PortfolioLinks } from "@/components/shared/PortfolioLinks";
import { StatCard } from "@/components/shared/StatCard";
import { RangeToggle } from "@/components/shared/RangeToggle";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { EstimatesStrip } from "./EstimatesStrip";
import { EstimatesDrawer } from "./EstimatesDrawer";
import { ProfitSummary } from "./ProfitSummary";
import { BestWorstCards } from "./BestWorstCards";
import { LeaderboardTable } from "./LeaderboardTable";
import { NeedsDataCard } from "./NeedsDataCard";
import shared from "@/styles/dashboard.module.css";
import styles from "./Returns.module.css";
const ranges = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y"] as const;
export type ReturnsPreview =
  | "sample"
  | "loading"
  | "refreshing"
  | "empty"
  | "error"
  | "hidden"
  | "unranked"
  | "complete";
type Props = {
  rows: HoldingReturn[];
  issues: string[];
  portfolio?: Portfolio;
  names?: Record<string, string>;
  isLoading?: boolean;
  preview?: ReturnsPreview;
};
function ReturnsContent({
  rows,
  issues,
  portfolio,
  names = {},
  isLoading = false,
  preview,
}: Props) {
  const router = useRouter(),
    [pending, startTransition] = useTransition();
  const currencies = [...new Set(rows.map((r) => r.currency))].sort(),
    rankedCurrencies = currencies.filter((c) =>
      rows.some((r) => r.currency === c && isRanked(r)),
    );
  const [currency, setCurrency] = useState(
    rankedCurrencies.includes("CAD")
      ? "CAD"
      : rankedCurrencies[0] || currencies[0] || "CAD",
  );
  const [sort, setSort] = useState<ReturnsSort>("profit-desc"),
    [tab, setTab] = useState<"leaderboard" | "chart">("leaderboard"),
    [range, setRange] = useState<(typeof ranges)[number]>("1Y"),
    [account, setAccount] = useState("all"),
    [search, setSearch] = useState(""),
    [details, setDetails] = useState(false);
  const loading = isLoading || preview === "loading",
    refreshing = pending || preview === "refreshing",
    refresh = () => startTransition(() => router.refresh());
  const cohort = rows.filter(
      (r) =>
        r.currency === currency &&
        (account === "all" || r.accounts.includes(account)),
    ),
    ranked = cohort.filter(isRanked),
    unranked = cohort.filter((r) => !isRanked(r));
  const matches = (r: HoldingReturn) =>
    `${r.symbol} ${names[r.symbol] || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  const sorted = sortReturns(ranked.filter(matches), sort),
    needs = unranked.filter(matches),
    accountNames = [...new Set(rows.flatMap((r) => r.accounts))].sort();
  const max = Math.max(0, ...ranked.map((r) => Math.abs(r.totalProfit!)));
  const expired =
      portfolio?.connections.status === "ok" &&
      portfolio.connections.data.some((c) => c.status === "Disabled"),
    failed = portfolio?.accounts.status === "error",
    configured = portfolio?.configured ?? true;
  return (
    <div className={`${shared.page} ${styles.page}`}>
      {!loading && <NavigationReady path="/returns" />}
      <a className={shared.skip} href="#returns-main">
        Skip to content
      </a>
      <WorkspaceHeader
        updatedAt={portfolio?.retrievedAt || new Date().toISOString()}
        onRefresh={refresh}
        loading={loading}
        refreshing={refreshing}
      />
      <main className={shared.main} id="returns-main">
        <div className={shared.titleRow}>
          <div>
            <h1>What has earned the most?</h1>
            <p>Lifetime holding estimates, including sales and dividends.</p>
          </div>
        </div>
        <DashboardNavigation path="/returns" />
        <PortfolioLinks path="/returns" group="performance" />
        {preview && (
          <aside className={shared.previewBanner}>
            Development preview: {preview}. All figures are invented sample
            data.
          </aside>
        )}
        {!loading && (!configured || failed || expired) && (
          <div className={shared.error} role="alert">
            <div>
              <strong>
                {expired
                  ? "Brokerage connection needs attention"
                  : !configured
                    ? "Connect your local account"
                    : "Holding returns could not load"}
              </strong>
              <p>
                {expired
                  ? "Reconnect in SnapTrade, then refresh. Available estimates may be stale."
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
                disabled={refreshing}
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
            <div className={styles.loading}>
              <div className={styles.summaryTiles}>
                {[0, 1, 2, 3].map((i) => (
                  <StatCard title="Loading profit" key={i}>
                    <div
                      className={`${shared.skeleton} ${shared.skeletonValue}`}
                    />
                  </StatCard>
                ))}
              </div>
              <div className={styles.bestWorst}>
                {["Loading best holding", "Loading worst holding"].map((t) => (
                  <StatCard title={t} key={t}>
                    <div
                      className={`${shared.skeleton} ${styles.cardSkeleton}`}
                    />
                  </StatCard>
                ))}
              </div>
              {["Loading leaderboard", "Loading data coverage"].map((t) => (
                <StatCard title={t} key={t}>
                  <div
                    className={`${shared.skeleton} ${styles.tableSkeleton}`}
                  />
                </StatCard>
              ))}
            </div>
          ) : (
            <>
              <EstimatesStrip
                ranked={ranked.length}
                total={cohort.length}
                caveats={issues.length > 0 || unranked.length > 0}
                onDetails={() => setDetails(true)}
              />
              <ProfitSummary
                rows={ranked}
                currency={currency}
                onCurrency={setCurrency}
                otherCurrencies={currencies.filter(
                  (c) => !["CAD", "USD"].includes(c),
                )}
              />
              <BestWorstCards rows={ranked} currency={currency} names={names} />
              <StatCard
                title={
                  tab === "leaderboard"
                    ? "All ranked holdings"
                    : "Compare return lines"
                }
                className={styles.listCard}
              >
                <div className={styles.controls}>
                  <div
                    className={styles.segmented}
                    role="group"
                    aria-label="Holdings performance views"
                  >
                    <button
                      type="button"
                      aria-pressed={tab === "leaderboard"}
                      onClick={() => setTab("leaderboard")}
                    >
                      Leaderboard
                    </button>
                    <button
                      type="button"
                      aria-pressed={tab === "chart"}
                      onClick={() => setTab("chart")}
                    >
                      Compare return lines
                    </button>
                  </div>
                  <label className={styles.search}>
                    Search holdings
                    <input
                      type="search"
                      placeholder="Ticker or name"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label>
                    Account association
                    <select
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                    >
                      <option value="all">All accounts</option>
                      {accountNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {tab === "leaderboard" && (
                    <label>
                      Sort by
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as ReturnsSort)}
                      >
                        <option value="profit-desc">
                          Total profit · high to low
                        </option>
                        <option value="profit-asc">
                          Total profit · low to high
                        </option>
                        <option value="percent">Return % · high to low</option>
                        <option value="realized">Realized · high to low</option>
                        <option value="unrealized">
                          Unrealized · high to low
                        </option>
                        <option value="dividends">
                          Dividends · high to low
                        </option>
                      </select>
                    </label>
                  )}
                  <InfoPopover label="Account filter and summary scope">
                    <p>
                      Account association filters holdings linked to the
                      selected account name. Each holding’s values remain
                      combined across all accounts listed in its details;
                      per-account profit breakdowns are not supplied. Summary
                      and best/worst cards use all ranked holdings in this
                      currency/account selection. Search filters the lists only.
                      Totals exclude unranked holdings, including their reported
                      dividends.
                    </p>
                  </InfoPopover>
                </div>
                <p className={styles.caption}>
                  Amounts in {currency} · combined holding totals · Search
                  filters the lists only.
                </p>
                {tab === "leaderboard" ? (
                  <>
                    {!rows.length ? (
                      <div className={styles.empty}>
                        <h3>No supported holding transactions</h3>
                        <p>
                          Recorded stock and fund transactions will appear after
                          a successful brokerage history sync.
                        </p>
                        <button
                          type="button"
                          className={shared.ghostButton}
                          onClick={refresh}
                          disabled={refreshing}
                        >
                          Retry history
                        </button>
                      </div>
                    ) : !ranked.length ? (
                      <div className={styles.empty}>
                        <p>
                          No holdings in this selection have enough reconciled
                          history to rank.
                        </p>
                        <button
                          type="button"
                          className={styles.textButton}
                          onClick={() => setDetails(true)}
                          aria-haspopup="dialog"
                        >
                          View estimate details
                        </button>
                      </div>
                    ) : (
                      <LeaderboardTable
                        key={`${currency}-${account}-${search}-${sort}`}
                        rows={sorted}
                        currency={currency}
                        names={names}
                        max={max}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <div className={styles.ranges}>
                      <RangeToggle
                        value={range}
                        onChange={setRange}
                        options={ranges.map((value) => ({
                          value,
                          label: value,
                        }))}
                        label="Planned comparison period"
                      />
                    </div>
                    <div className={styles.empty} role="status">
                      <h3>Historical price provider required</h3>
                      <p>
                        The {range} comparison is not connected. Individual
                        daily stock prices are not supplied by account value
                        history.
                      </p>
                      <p>
                        No return lines are estimated from transaction prices.
                        Planned axes: duration held and return %.
                      </p>
                    </div>
                  </>
                )}
              </StatCard>
              <NeedsDataCard
                key={`${currency}-${account}`}
                rows={needs}
                currency={currency}
              />
            </>
          )}
        </div>
        <EstimatesDrawer
          open={details}
          onClose={() => setDetails(false)}
          issues={issues}
        />
        <p className={styles.srOnly} role="status">
          {loading
            ? "Loading holding returns."
            : refreshing
              ? "Refreshing holding returns."
              : "Holding returns ready."}
        </p>
        <footer className={shared.footer}>
          Read-only lifetime estimates · No trading or stored brokerage data.
          Logos by{" "}
          <a href="https://www.logo.dev" target="_blank" rel="noreferrer">
            Logo.dev
          </a>
          .
        </footer>
      </main>
    </div>
  );
}
export function HoldingReturnsDashboard(props: Props) {
  return props.preview === "hidden" ? (
    <BalancePrivacyProvider initialHidden>
      <ReturnsContent {...props} />
    </BalancePrivacyProvider>
  ) : (
    <ReturnsContent {...props} />
  );
}
