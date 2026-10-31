"use client";
import { SampleNotice } from "@/components/shared/SampleNotice";
import {
  Select,
  Switch,
  SortDirectionButton,
} from "@/components/shared/Select";
import { useId, useRef, useState } from "react";
import { useProtectedRefresh } from "@/components/shared/useProtectedRefresh";
import type { Portfolio, ExchangeRate, Result } from "@/lib/types";
import {
  flattenHoldings,
  allocationView,
  inCurrency,
  type HoldingsCurrency,
} from "@/lib/holdings/holdings-view";
import { isOption } from "@/lib/holdings/holdings";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { NavigationReady } from "@/components/layout/NavigationProgress";
import { DashboardNavigation } from "@/components/layout/DashboardNavigation";
import { PortfolioLinks } from "@/components/shared/PortfolioLinks";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { StatCard } from "@/components/shared/StatCard";
import { SummaryStrip } from "./SummaryStrip";
import { AllocationCard } from "./AllocationCard";
import { HoldingsTable, type HoldingsSort } from "./HoldingsTable";
import shared from "@/styles/dashboard.module.css";
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
  const { pending, refresh, cooldown } = useProtectedRefresh();
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
        refreshBlocked={cooldown}
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
        {preview && <SampleNotice href="/holdings" />}
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
                disabled={refreshing || cooldown}
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
              disabled={refreshing || cooldown}
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
                  <StatCard title={`Loading summary ${i + 1}`} key={i}>
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
                      <Switch
                        checked={group}
                        onCheckedChange={setGroup}
                        label="Group by account"
                      />
                    }
                  >
                    <div className={styles.positionControls}>
                      <div
                        className={styles.segmented}
                        role="tablist"
                        aria-label="Position type"
                      >
                        {(["holdings", "options"] as const).map(
                          (type, index) => (
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
                          ),
                        )}
                      </div>
                      <label>
                        <span className={styles.srOnly}>Filter by account</span>
                        <Select
                          aria-label="Filter by account"
                          value={accountId}
                          onChange={(e) => setAccountId(e.target.value)}
                        >
                          <option value="all">All accounts</option>
                          {accounts.map((a) => (
                            <option key={a.account.id} value={a.account.id}>
                              {a.account.name}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className={styles.search}>
                        <span className={styles.srOnly}>Search positions</span>
                        <input
                          type="search"
                          placeholder="Ticker or name"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      </label>

                      <div className={styles.sortGroup}>
                        {" "}
                        <label className={styles.search}>
                          <span className={styles.srOnly}>Sort positions</span>
                          <Select
                            aria-label="Sort positions"
                            value={sort.key}
                            onChange={(event) =>
                              setSort({
                                key: event.target.value as HoldingsSort["key"],
                                direction: "descending",
                              })
                            }
                          >
                            {(
                              [
                                ["value", "Market value"],
                                ["quantity", "Quantity"],
                                ["averageCost", "Average cost"],
                                ["price", "Last price"],
                                ["return", "Net return"],
                                ["weight", "Weight"],
                                ["holding", "Holding"],
                                ["account", "Account"],
                              ] as const
                            ).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </label>
                        <SortDirectionButton
                          direction={sort.direction}
                          onChange={(direction) =>
                            setSort((s) => ({ ...s, direction }))
                          }
                        />
                      </div>
                      <InfoPopover label="Position filters, weights and sorting">
                        <p>
                          Monetary sort values use the selected display
                          currency. Missing values sort last. Weights and
                          allocation use all positive positions in selected
                          accounts. Search and Holdings / Options change the
                          list only.
                        </p>
                      </InfoPopover>
                    </div>
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
