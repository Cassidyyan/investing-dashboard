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
  } catch (error) {
    const status = (error as { response?: { status?: number } } | null)
      ?.response?.status;
    return {
      status: "error",
      message:
        status === 429
          ? "Brokerage rate limit reached. Wait before refreshing; available sections remain visible."
          : status === 401 || status === 403
            ? "SnapTrade rejected this read. Verify your own Personal credentials in .env.local, restart the server, and check connection permissions in SnapTrade."
            : "Could not retrieve this section. Check your connection and try refreshing.",
    };
  }
}
function mapResult<T, U>(r: Result<T>, map: (data: T) => U): Result<U> {
  if (r.status === "error") return { status: "error", message: r.message };
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
  const [accountResponse, connections] = await Promise.all([
    settle(client.accounts),
    settle(client.connections),
  ]);
  const accounts = mapResult(accountResponse, (data) => {
    if (!Array.isArray(data)) throw new Error("Account list unavailable.");
    return data;
  });
  if (accounts.status === "error")
    return {
      configured: true,
      retrievedAt: new Date().toISOString(),
      accounts: { status: "error", message: accounts.message },
      connections: mapResult(connections, normalizeConnections),
    };
  // Current views hide zero totals. History keeps them for fully sold holdings.
  const visibleAccounts = accounts.data.filter(
    (a) =>
      (scope === "history"
        ? a?.account_category !== "DEPOSIT" && a?.account_category !== "LOC"
        : scope === "investing"
          ? a?.account_category !== "DEPOSIT"
          : a?.account_category !== "LOC") &&
      (scope === "history" ||
        !(
          ["CAD", "USD"].includes(a?.balance?.total?.currency ?? "") &&
          numeric(a?.balance?.total?.amount) === 0
        )),
  );
  const settled = await Promise.allSettled(
    visibleAccounts.map(async (a) => {
      // Every page checks positions once so empty accounts stay out consistently.
      // Keep failures and incomplete/stale responses visible rather than guessing.
      const account = normalizeAccount(a);
      const depositAccount = a?.account_category === "DEPOSIT";
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
        orders: mapResult(orders, (data) => normalizeOrders(data, a.id)),
        activities: mapResult(activities, (data) =>
          normalizeActivities(data, a.id),
        ),
      };
    }),
  );
  // A malformed account remains visible as a failed section rather than disappearing.
  const rows = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          account: {
            id: visibleAccounts[i]?.id || `invalid-${i}`,
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
