"use client";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Portfolio, ExchangeRate, Result } from "@/lib/types";
import {
  flattenHoldings,
  allocationView,
  inCurrency,
  type HoldingsCurrency,
} from "@/lib/holdings-view";
import { isOption } from "@/lib/holdings";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import {
  NavigationLink,
  NavigationReady,
} from "@/components/layout/NavigationProgress";
import { DashboardNavigation } from "@/components/layout/DashboardNavigation";
import { PortfolioLinks } from "@/components/shared/PortfolioLinks";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { StatCard } from "@/components/overview/StatCard";
import { SummaryStrip } from "./SummaryStrip";
import { AllocationCard } from "./AllocationCard";
import { HoldingsTable, type HoldingsSort } from "./HoldingsTable";
import shared from "@/components/overview/Overview.module.css";
import styles from "./Holdings.module.css";
export type HoldingsPreview =
  "sample" | "loading" | "refreshing" | "empty" | "error" | "hidden";
type Props = {
  portfolio: Portfolio;
  rate: Result<ExchangeRate>;
  logos?: Record<string, string | null>;
  isLoading?: boolean;
  preview?: HoldingsPreview;
};
function HoldingsContent({
  portfolio,
  rate,
  logos = {},
  isLoading = false,
  preview,
}: Props) {
  const router = useRouter(),
    [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<HoldingsCurrency>("COMBINED_USD"),
    [tab, setTab] = useState<"holdings" | "options">("holdings"),
    [accountId, setAccountId] = useState("all"),
    [search, setSearch] = useState(""),
    [group, setGroup] = useState(false),
    [sort, setSort] = useState<HoldingsSort>({
      key: "value",
      direction: "descending",
    });
  const id = useId(),
    buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const loading = isLoading || preview === "loading",
    refreshing = pending || preview === "refreshing";
  const refresh = () => startTransition(() => router.refresh());
  const accounts =
    portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const selected =
    accountId === "all"
      ? accounts
      : accounts.filter((a) => a.account.id === accountId);
  const all = flattenHoldings(selected).map((e) => ({
    ...e,
    logoUrl: logos[`${e.position.symbol}|${e.position.kind}`] ?? null,
  }));
  const rows = all
    .filter(
      (e) =>
        e.position.units !== 0 &&
        inCurrency(e.position, mode) &&
        (tab === "options"
          ? isOption(e.position.kind)
          : !isOption(e.position.kind)),
    )
    .filter((e) =>
      `${e.position.symbol} ${e.position.description} ${e.position.optionDetails?.underlyingSymbol || ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    );
  const total = allocationView(selected, mode, "holding", rate).total;
  const failed = portfolio.accounts.status === "error",
    expired =
      portfolio.connections.status === "ok" &&
      portfolio.connections.data.some((c) => c.status === "Disabled");
  const unavailable = selected.filter((a) => a.positions.status === "error");
  const stale = selected.some((a) => a.account.stale || a.account.incomplete);
  return (
    <div className={`${shared.page} ${styles.page}`}>
      {!loading && <NavigationReady path="/holdings" />}
      <a href="#holdings-main" className={shared.skip}>
        Skip to content
      </a>
      <WorkspaceHeader
        updatedAt={portfolio.retrievedAt}
        loading={loading}
        refreshing={refreshing}
        onRefresh={refresh}
      />
      <main id="holdings-main" className={shared.main}>
        <div className={shared.titleRow}>
          <div>
            <h1>What you own</h1>
            <p>Positions and allocation, with the detail when you need it.</p>
          </div>
        </div>
        <DashboardNavigation path="/holdings" />
        <PortfolioLinks path="/holdings" />
        {preview && (
          <aside className={shared.previewBanner}>
            Development preview: {preview}. All figures are invented sample
            data.{" "}
            <NavigationLink href="/holdings">
              Return to live positions
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
                    : "We couldn’t load your positions"}
              </strong>
              <p>
                {!portfolio.configured
                  ? "Configure your existing credentials locally in .env.local and restart the server."
                  : expired
                    ? "Reconnect in SnapTrade, then refresh. Available snapshots may be out of date."
                    : portfolio.accounts.status === "error"
                      ? portfolio.accounts.message
                      : "Try Refresh."}
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
        {!loading && (unavailable.length > 0 || stale) && (
          <p className={styles.partial} role="status">
            {unavailable.length > 0
              ? `${unavailable.length} accounts could not load positions. `
              : ""}
            {stale ? "Some account snapshots are stale or incomplete. " : ""}
            <button
              type="button"
              className={styles.textButton}
              disabled={refreshing}
              onClick={refresh}
            >
              Retry
            </button>
          </p>
        )}
        <div className={styles.srOnly} role="status">
          {loading
            ? "Loading positions."
            : refreshing
              ? "Refreshing positions."
              : failed
                ? "Positions unavailable."
                : "Positions ready."}
        </div>
        <div
          className={refreshing ? shared.refreshing : undefined}
          aria-busy={loading || refreshing}
        >
          {loading ? (
            <>
              <div className={styles.summaryStrip}>
                {[0, 1, 2].map((i) => (
                  <StatCard title="Loading summary" key={i}>
                    <div
                      className={`${shared.skeleton} ${shared.skeletonValue}`}
                    />
                  </StatCard>
                ))}
              </div>
              <div className={styles.mainGrid}>
                <StatCard
                  title="Loading positions"
                  className={styles.holdingsCard}
                >
                  <div
                    className={`${shared.skeleton} ${styles.skeletonTable}`}
                  />
                </StatCard>
                <StatCard
                  title="Loading allocation"
                  className={styles.allocationCard}
                >
                  <div
                    className={`${shared.skeleton} ${styles.skeletonDonut}`}
                  />
                </StatCard>
              </div>
            </>
          ) : (
            !failed && (
              <>
                <SummaryStrip
                  accounts={selected}
                  mode={mode}
                  onMode={setMode}
                  rate={rate}
                />
                <div className={styles.mainGrid}>
                  <StatCard
                    title="Your positions"
                    className={styles.holdingsCard}
                    action={
                      <label className={styles.groupToggle}>
                        <input
                          type="checkbox"
                          checked={group}
                          onChange={(e) => setGroup(e.target.checked)}
                        />
                        Group by account
                      </label>
                    }
                  >
                    <div
                      className={styles.segmented}
                      role="tablist"
                      aria-label="Position type"
                    >
                      {(["holdings", "options"] as const).map((type, index) => (
                        <button
                          ref={(node) => {
                            buttons.current[index] = node;
                          }}
                          key={type}
                          id={`${id}-${type}-tab`}
                          role="tab"
                          type="button"
                          aria-selected={tab === type}
                          aria-controls={`${id}-${type}-panel`}
                          tabIndex={tab === type ? 0 : -1}
                          onClick={() => setTab(type)}
                          onKeyDown={(event) => {
                            let target = index;
                            if (
                              event.key === "ArrowRight" ||
                              event.key === "ArrowLeft"
                            )
                              target = 1 - index;
                            else if (event.key === "Home") target = 0;
                            else if (event.key === "End") target = 1;
                            else return;
                            event.preventDefault();
                            setTab(target === 0 ? "holdings" : "options");
                            buttons.current[target]?.focus();
                          }}
                        >
                          {type === "holdings" ? "Holdings" : "Options"}
                        </button>
                      ))}
                    </div>
                    <div className={styles.filters}>
                      <div
                        className={styles.accountChips}
                        role="group"
                        aria-label="Filter by account"
                      >
                        <button
                          type="button"
                          aria-pressed={accountId === "all"}
                          onClick={() => setAccountId("all")}
                        >
                          All accounts
                        </button>
                        {accounts.map((a) => (
                          <button
                            type="button"
                            key={a.account.id}
                            aria-pressed={accountId === a.account.id}
                            onClick={() => setAccountId(a.account.id)}
                          >
                            {a.account.name}
                          </button>
                        ))}
                      </div>
                      <label className={styles.search}>
                        Search positions
                        <input
                          type="search"
                          placeholder="Ticker or name"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      </label>
                    </div>
                    <p className={styles.footnote}>
                      Weights and allocation use all positive positions in
                      selected accounts. Search and the Holdings / Options tabs
                      change the list only.
                    </p>
                    <div
                      id={`${id}-${tab}-panel`}
                      role="tabpanel"
                      aria-labelledby={`${id}-${tab}-tab`}
                      tabIndex={0}
                    >
                      {rows.length ? (
                        <HoldingsTable
                          entries={rows}
                          group={group}
                          sort={sort}
                          onSort={(key) =>
                            setSort((s) => ({
                              key,
                              direction:
                                s.key === key && s.direction === "descending"
                                  ? "ascending"
                                  : "descending",
                            }))
                          }
                          mode={mode}
                          rate={rate}
                          total={total}
                          accounts={accounts}
                        />
                      ) : (
                        <p className={styles.empty}>
                          {tab === "options"
                            ? "No option positions"
                            : "No holding positions"}
                          {search
                            ? " match your search"
                            : " in this currency/account selection"}
                          .{" "}
                          {unavailable.length
                            ? "Some positions could not load; try Retry."
                            : ""}
                        </p>
                      )}
                    </div>
                  </StatCard>
                  <AllocationCard
                    accounts={selected}
                    rate={rate}
                    mode={mode}
                    onMode={setMode}
                  />
                </div>
              </>
            )
          )}
        </div>
        <footer className={shared.footer}>
          Read-only snapshots may lag. Updated time is retrieval time. No
          trading or stored brokerage data. Logos by{" "}
          <a href="https://www.logo.dev" target="_blank" rel="noreferrer">
            Logo.dev
          </a>
          .
        </footer>
      </main>
    </div>
  );
}
export function HoldingsDashboard(props: Props) {
  return props.preview === "hidden" ? (
    <BalancePrivacyProvider initialHidden>
      <HoldingsContent {...props} />
    </BalancePrivacyProvider>
  ) : (
    <HoldingsContent {...props} />
  );
}
