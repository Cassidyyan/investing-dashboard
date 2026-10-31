"use client";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { SampleNotice } from "@/components/shared/SampleNotice";
import type { ActivityPreview } from "@/dev/previews/activity-preview";
import { useState } from "react";
import type { Portfolio, Money as MoneyData } from "@/lib/types";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { DashboardNavigation } from "@/components/layout/DashboardNavigation";
import {
  NavigationReady,
  NavigationLink,
} from "@/components/layout/NavigationProgress";
import { StatCard, CardSkeleton } from "@/components/shared/StatCard";
import { Money } from "@/components/shared/Money";
import { PrivateValue } from "@/components/shared/BalancePrivacy";
import { ActivityIcon } from "@/components/shared/ActivityIcon";
import { Select } from "@/components/shared/Select";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { useProtectedRefresh } from "@/components/shared/useProtectedRefresh";
import { date, quantity } from "@/lib/format";
import shared from "@/styles/dashboard.module.css";
import styles from "./Activity.module.css";
type FeedItem = {
  id: string;
  description: string;
  account: string;
  accountId: string;
  type: string;
  date: string | null;
  amount: MoneyData | null;
  status?: string;
  quantity?: number | null;
};
const localDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value));
function dateGroup(value: string | null, today: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date unavailable";
  const day = localDay(value);
  const days = Math.round(
    (Date.parse(localDay(today)) - Date.parse(day)) / 86400000,
  );
  const weekDay =
    (new Date(`${localDay(today)}T00:00:00Z`).getUTCDay() + 6) % 7;
  if (days < 0) return "Future-dated";
  return days === 0
    ? "Today"
    : days === 1
      ? "Yesterday"
      : days >= 2 && days <= weekDay
        ? "This week"
        : "Earlier";
}
function activityDate(value: string | null) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  return date(value);
}
function ActivityContent({
  portfolio,
  isLoading = false,
  preview,
}: {
  portfolio: Portfolio;
  isLoading?: boolean;
  preview?: ActivityPreview;
}) {
  const { pending, refresh, cooldown } = useProtectedRefresh();
  const [tab, setTab] = useState<"transactions" | "orders">("transactions"),
    [account, setAccount] = useState("all"),
    [type, setType] = useState("all"),
    [search, setSearch] = useState(""),
    [limit, setLimit] = useState(15);
  const accounts =
    portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const expired =
    portfolio.connections.status === "ok" &&
    portfolio.connections.data.some((c) => c.status === "Disabled");
  const failed = portfolio.accounts.status === "error";
  const items: FeedItem[] = accounts.flatMap<FeedItem>((a) =>
    tab === "transactions"
      ? a.activities.status === "ok"
        ? a.activities.data.rows.map((r, i) => ({
            id: `${a.account.id}-transaction-${i}`,
            description: r.description || r.type,
            account: a.account.name,
            accountId: a.account.id,
            type: r.type,
            date: r.date,
            amount: r.amount,
          }))
        : []
      : a.orders.status === "ok"
        ? a.orders.data.map((r, i) => ({
            id: `${a.account.id}-order-${i}`,
            description: `${r.action} ${r.symbol}`,
            account: a.account.name,
            accountId: a.account.id,
            type: r.action,
            date: r.placedAt,
            amount: null,
            status: r.status,
            quantity: r.quantity,
          }))
        : [],
  );
  const types = [...new Set(items.map((r) => r.type))].sort();
  const selectedType = types.includes(type) ? type : "all";
  const rows = items
    .filter(
      (r) =>
        (account === "all" || r.accountId === account) &&
        (selectedType === "all" || r.type === selectedType) &&
        `${r.description} ${r.account}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (b.date ? Date.parse(b.date) || 0 : 0) -
        (a.date ? Date.parse(a.date) || 0 : 0),
    );
  const shown = rows.slice(0, limit),
    groups = [
      ...new Set(shown.map((r) => dateGroup(r.date, portfolio.retrievedAt))),
    ];
  const partial = accounts.some(
    (a) =>
      (tab === "transactions" ? a.activities : a.orders).status === "error",
  );
  const reset = () => setLimit(15);
  return (
    <div className={shared.page}>
      {!isLoading && <NavigationReady path="/activity" />}
      <a className={shared.skip} href="#activity-main">
        Skip to content
      </a>
      <WorkspaceHeader
        updatedAt={portfolio.retrievedAt}
        loading={isLoading}
        refreshing={pending}
        refreshBlocked={cooldown}
        onRefresh={refresh}
      />
      <main id="activity-main" className={shared.main}>
        <div className={shared.titleRow}>
          <div>
            <h1>Your activity</h1>
            <p>Transactions and orders, together in one place.</p>
          </div>
        </div>
        <DashboardNavigation path="/activity" />
        {preview && <SampleNotice href="/activity" />}
        {(!portfolio.configured || failed || expired) && !isLoading && (
          <div className={shared.error} role="alert">
            <div>
              <strong>
                {expired
                  ? "Brokerage connection needs attention"
                  : "Activity could not be loaded"}
              </strong>
              <p>
                {!portfolio.configured
                  ? "Configure your existing SnapTrade credentials locally to load activity."
                  : portfolio.accounts.status === "error"
                    ? portfolio.accounts.message
                    : "Reconnect in SnapTrade, then retry."}
              </p>
            </div>
            <a
              className={shared.ghostButton}
              href="https://dashboard.snaptrade.com"
              target="_blank"
              rel="noreferrer"
            >
              Reconnect in SnapTrade ↗
            </a>
            <button
              className={shared.ghostButton}
              type="button"
              onClick={refresh}
              disabled={pending || cooldown}
            >
              Retry
            </button>
          </div>
        )}
        {isLoading ? (
          <>
            <div className={shared.srOnly} role="status">
              Loading activity…
            </div>
            <CardSkeleton />
          </>
        ) : (
          <div
            className={pending ? shared.refreshing : undefined}
            aria-busy={pending}
          >
            <StatCard
              title="Activity"
              action={
                <InfoPopover label="Activity coverage and order fields">
                  <p>
                    Transactions include up to 25 items per account from the
                    last 90 days. Orders use the existing recent-orders
                    response. Filters and Show more only reveal already-loaded
                    items; this is not an exhaustive ledger.
                  </p>
                  <p>
                    Order amounts and execution prices are not supplied by this
                    view. Quantities and statuses remain as reported.
                  </p>
                </InfoPopover>
              }
            >
              <div className={styles.controls}>
                <div
                  className={styles.tabs}
                  role="group"
                  aria-label="Activity view"
                >
                  {(["transactions", "orders"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={tab === value}
                      onClick={() => {
                        setTab(value);
                        setType("all");
                        reset();
                      }}
                    >
                      {value === "transactions" ? "Transactions" : "Orders"}
                    </button>
                  ))}
                </div>
                <Select
                  aria-label="Account"
                  value={account}
                  onChange={(e) => {
                    setAccount(e.target.value);
                    reset();
                  }}
                >
                  <option value="all">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a.account.id} value={a.account.id}>
                      {a.account.name}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Activity type"
                  value={selectedType}
                  onChange={(e) => {
                    setType(e.target.value);
                    reset();
                  }}
                >
                  <option value="all">All types</option>
                  {types.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
                <input
                  type="search"
                  aria-label="Search activity"
                  placeholder="Search activity"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    reset();
                  }}
                />
              </div>
              {partial && (
                <p className={shared.notice} role="status">
                  Some accounts could not load {tab}. Available items remain
                  visible.
                </p>
              )}
              {!rows.length ? (
                <div className={styles.empty}>
                  <ActivityIcon type={tab} />
                  <h3>
                    {tab === "orders"
                      ? "No recent orders available"
                      : "No transactions to show"}
                  </h3>
                  <p>
                    {search || account !== "all" || selectedType !== "all"
                      ? "Try a different account, type or search."
                      : "Items appear after your brokerage supplies them."}
                  </p>
                  <NavigationLink href="/accounts">
                    View investing accounts
                  </NavigationLink>
                </div>
              ) : (
                groups.map((group) => (
                  <section
                    key={group}
                    aria-label={`${group} ${tab}`}
                    className={styles.group}
                  >
                    <h3>{group}</h3>
                    <ul className={styles.feed}>
                      {shown
                        .filter(
                          (r) =>
                            dateGroup(r.date, portfolio.retrievedAt) === group,
                        )
                        .map((item) => (
                          <li key={item.id}>
                            <ActivityIcon type={item.type} />
                            <div className={styles.description}>
                              <strong title={item.description}>
                                {item.description}
                              </strong>
                              <small>
                                {item.type}
                                {item.status ? ` · ${item.status}` : ""}
                              </small>
                            </div>
                            <span
                              className={styles.account}
                              title={item.account}
                            >
                              {item.account}
                            </span>
                            <time dateTime={item.date || undefined}>
                              {activityDate(item.date)}
                            </time>
                            <span className={styles.amount}>
                              {item.amount ? (
                                <Money value={item.amount} />
                              ) : (
                                <span>
                                  <PrivateValue>
                                    {quantity(item.quantity ?? null)}
                                  </PrivateValue>{" "}
                                  units
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </section>
                ))
              )}
              {rows.length > limit && (
                <button
                  className={shared.ghostButton}
                  type="button"
                  onClick={() => setLimit(limit + 15)}
                >
                  Show more ({rows.length - limit})
                </button>
              )}
              <p className={shared.footnote}>
                {rows.length} loaded {tab} match these filters.
              </p>
            </StatCard>
          </div>
        )}
        <footer className={shared.footer}>
          Read-only · No trading · No stored brokerage data. Source history may
          be incomplete.
        </footer>
      </main>
    </div>
  );
}

export function ActivityDashboard(props: {
  portfolio: Portfolio;
  isLoading?: boolean;
  preview?: ActivityPreview;
}) {
  return props.preview === "hidden" ? (
    <BalancePrivacyProvider initialHidden>
      <ActivityContent {...props} />
    </BalancePrivacyProvider>
  ) : (
    <ActivityContent {...props} />
  );
}
