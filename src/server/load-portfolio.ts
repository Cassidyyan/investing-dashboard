import "server-only";

// Load independent sections together, preserving successful data if another request fails.

import { getSnaptrade, type ReadClient } from "@/server/snaptrade";
import {
  numeric,
  normalizeAccount,
  normalizeBalances,
  normalizePositions,
  normalizeOrders,
  normalizeActivities,
  normalizeConnections,
} from "@/server/normalize";
import type { Result, Portfolio } from "@/lib/types";
async function settle<T>(
  request: () => Promise<{ data: T }>,
): Promise<Result<T>> {
  try {
    return { status: "ok", data: (await request()).data };
  } catch {
    return {
      status: "error",
      message:
        "Could not retrieve this section. Check your connection and try refreshing.",
    };
  }
}
function mapResult<T, U>(r: Result<T>, map: (data: T) => U): Result<U> {
  if (r.status === "error") return r;
  try {
    return { status: "ok", data: map(r.data) };
  } catch {
    return {
      status: "error",
      message: "This section returned data that could not be displayed.",
    };
  }
}
export type AccountScope = "investing" | "cash" | "overview" | "history";

export type PortfolioSection =
  "balances" | "positions" | "orders" | "activities";

export async function loadPortfolio(
  client: ReadClient | null = getSnaptrade(),
  sections: readonly PortfolioSection[] = [
    "balances",
    "positions",
    "orders",
    "activities",
  ],
  scope: AccountScope = "investing",
): Promise<Portfolio> {
  const unavailable = {
    status: "error" as const,
    message:
      "Configure your local SnapTrade credentials to load your accounts.",
  };
  if (!client)
    return {
      configured: false,
      retrievedAt: new Date().toISOString(),
      accounts: unavailable,
      connections: unavailable,
    };
  const [accounts, connections] = await Promise.all([
    settle(client.accounts),
    settle(client.connections),
  ]);
  if (accounts.status === "error")
    return {
      configured: true,
      retrievedAt: new Date().toISOString(),
      accounts,
      connections: mapResult(connections, normalizeConnections),
    };
  // Current views hide zero totals. History keeps them for fully sold holdings.
  const visibleAccounts = accounts.data.filter(
    (a) =>
      (scope === "history"
        ? a.account_category !== "DEPOSIT" && a.account_category !== "LOC"
        : scope === "investing"
          ? a.account_category !== "DEPOSIT"
          : a.account_category !== "LOC") &&
      (scope === "history" ||
        !(
          ["CAD", "USD"].includes(a.balance?.total?.currency ?? "") &&
          numeric(a.balance?.total?.amount) === 0
        )),
  );
  const settled = await Promise.allSettled(
    visibleAccounts.map(async (a) => {
      // Every page checks positions once so empty accounts stay out consistently.
      // Keep failures and incomplete/stale responses visible rather than guessing.
      const account = normalizeAccount(a);
      const depositAccount = a.account_category === "DEPOSIT";
      const positions = depositAccount
        ? { status: "ok" as const, data: { rows: [], asOf: null } }
        : mapResult(
            await settle(() => client.positions(a.id)),
            normalizePositions,
          );
      const confirmedEmpty =
        positions.status === "ok" &&
        !account.incomplete &&
        !account.stale &&
        !positions.data.rows.some((p) => p.units !== 0);
      if (
        scope === "cash"
          ? !depositAccount && !confirmedEmpty
          : scope === "investing" && confirmedEmpty
      )
        return null;
      const [balances, orders, activities] = await Promise.all([
        sections.includes("balances")
          ? settle(() => client.balances(a.id))
          : { status: "ok" as const, data: [] },
        sections.includes("orders")
          ? settle(() => client.orders(a.id))
          : { status: "ok" as const, data: { orders: [] } },
        sections.includes("activities")
          ? settle(() => client.activities(a.id))
          : { status: "ok" as const, data: { data: [] } },
      ]);
      return {
        cashOnly: depositAccount || confirmedEmpty,
        account,
        balances: mapResult(balances, normalizeBalances),
        positions,
        orders: mapResult(orders, normalizeOrders),
        activities: mapResult(activities, normalizeActivities),
      };
    }),
  );
  // A malformed account remains visible as a failed section rather than disappearing.
  const rows = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          account: {
            id: visibleAccounts[i].id || `invalid-${i}`,
            name: "Account data unavailable",
            institution: "Unknown institution",
            suffix: "Unavailable",
            type: "Unknown",
            value: { amount: null, currency: null },
            syncedAt: null,
            incomplete: true,
            stale: false,
          },
          balances: {
            status: "error" as const,
            message: "Account data unavailable.",
          },
          positions: {
            status: "error" as const,
            message: "Account data unavailable.",
          },
          orders: {
            status: "error" as const,
            message: "Account data unavailable.",
          },
          activities: {
            status: "error" as const,
            message: "Account data unavailable.",
          },
        },
  );
  return {
    configured: true,
    retrievedAt: new Date().toISOString(),
    accounts: { status: "ok", data: rows.filter((row) => row !== null) },
    connections: mapResult(connections, normalizeConnections),
  };
}
