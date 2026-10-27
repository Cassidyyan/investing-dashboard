import "server-only";

// Convert SnapTrade responses into display objects; missing amounts remain null, not zero.

import type {
  Account,
  Balance,
  AllAccountPositionsResponse,
  RecentOrdersResponse,
  PaginatedUniversalActivity,
  BrokerageAuthorization,
} from "snaptrade-typescript-sdk";
import type {
  AccountView,
  BalanceView,
  PositionView,
  OrderView,
  ActivityView,
  ConnectionView,
} from "@/lib/types";
export function numeric(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function normalizeAccount(a: Account): AccountView {
  const sync = a.sync_status?.holdings;
  const syncedAt = sync?.last_successful_sync ?? null;
  return {
    id: a.id,
    category: a.account_category ?? null,
    name: a.name || "Unnamed account",
    institution: a.institution_name || "Unknown institution",
    suffix: a.number ? `•••• ${a.number.slice(-4)}` : "Unavailable",
    type: a.raw_type || a.account_category || "Unknown type",
    value: {
      amount: numeric(a.balance?.total?.amount),
      currency: a.balance?.total?.currency || null,
    },
    syncedAt,
    incomplete:
      sync?.initial_sync_completed === false ||
      sync?.holdings_unavailable === true,
    stale: !!syncedAt && Date.now() - Date.parse(syncedAt) > 36 * 3600000,
  };
}
export function normalizeBalances(rows: Balance[]): BalanceView[] {
  return rows.map((b) => ({
    cash: { amount: numeric(b.cash), currency: b.currency?.code || null },
    buyingPower: {
      amount: numeric(b.buying_power),
      currency: b.currency?.code || null,
    },
  }));
}
export function normalizePositions(data: AllAccountPositionsResponse): {
  rows: PositionView[];
  asOf: string | null;
} {
  return {
    asOf: data.data_freshness?.as_of || null,
    rows: data.results.map((p) => {
      const i = p.instrument;
      const units = numeric(p.units),
        price = numeric(p.price);
      const currency =
        p.currency ||
        ("currency" in i && typeof i.currency === "string" ? i.currency : null);
      // SnapTrade labels this CAD-listed trust as "other". Its issuer confirms
      // per-unit pricing: https://sprott.com/media/xcilumow/phys.pdf
      // Keep this exception narrow; arbitrary "other" instruments may need
      // valuation conventions that units × price cannot represent.
      const knownUnitPricedTrust =
        i.kind === "other" && i.symbol === "PHYS.TO" && currency === "CAD";
      const multiplier =
        i.kind === "option"
          ? numeric(i.multiplier)
          : ["stock", "adr", "cef", "etf", "mutualfund", "crypto"].includes(
                i.kind,
              ) || knownUnitPricedTrust
            ? 1
            : null;
      const computed =
        units !== null && price !== null && multiplier !== null
          ? units * price * multiplier
          : null;
      const rawCost = numeric(p.cost_basis);
      const averageCost = rawCost !== null && rawCost >= 0 ? rawCost : null;
      const rawReturn =
        currency &&
        price !== null &&
        averageCost !== null &&
        units !== null &&
        multiplier !== null
          ? (price - averageCost) * units * multiplier
          : null;
      const unrealizedReturn =
        rawReturn !== null && Number.isFinite(rawReturn) ? rawReturn : null;
      const invested =
        averageCost !== null && units !== null && multiplier !== null
          ? Math.abs(averageCost * units * multiplier)
          : null;
      const rawPercent =
        unrealizedReturn !== null &&
        invested !== null &&
        Number.isFinite(invested) &&
        invested > 0
          ? (unrealizedReturn / invested) * 100
          : null;
      return {
        instrumentId: i.id,
        optionDetails:
          i.kind === "option" || i.kind === "future_option"
            ? {
                type:
                  i.option_type === "CALL" || i.option_type === "PUT"
                    ? i.option_type
                    : null,
                strike: { amount: numeric(i.strike_price), currency },
                expiration: i.expiration_date || null,
                multiplier: numeric(i.multiplier),
                underlyingId: i.underlying?.id || null,
                underlyingSymbol: i.underlying?.symbol || null,
                underlyingKind: i.underlying?.kind || null,
              }
            : null,
        cashEquivalent: p.cash_equivalent === true,
        symbol: i.symbol || "Unknown",
        description: typeof i.description === "string" ? i.description : "",
        kind: i.kind,
        units,
        price: { amount: price, currency },
        averageCost: { amount: averageCost, currency },
        unrealizedReturn: { amount: unrealizedReturn, currency },
        unrealizedReturnPercent:
          rawPercent !== null && Number.isFinite(rawPercent)
            ? rawPercent
            : null,
        value: {
          amount:
            computed !== null && Number.isFinite(computed) ? computed : null,
          currency,
        },
      };
    }),
  };
}
export function normalizeOrders(data: RecentOrdersResponse): OrderView[] {
  return (data.orders || [])
    .map((o) => ({
      symbol:
        o.symbol ||
        o.universal_symbol?.symbol ||
        o.option_symbol?.ticker ||
        "Unknown",
      action: o.action || "Unknown",
      status: typeof o.status === "string" ? o.status : "Unknown",
      quantity: numeric(o.total_quantity),
      placedAt: o.time_placed || null,
    }))
    .sort(
      (a, b) =>
        (Date.parse(b.placedAt || "") || 0) -
        (Date.parse(a.placedAt || "") || 0),
    );
}
export function normalizeActivities(data: PaginatedUniversalActivity): {
  rows: ActivityView[];
  total: number | null;
} {
  return {
    total: numeric(data.pagination?.total),
    rows: (data.data || [])
      .map((a) => ({
        description: a.description || a.symbol?.symbol || "Account activity",
        type: a.type || "Unknown",
        date: a.trade_date || a.settlement_date || null,
        amount: {
          amount: numeric(a.amount),
          currency: a.currency?.code || null,
        },
      }))
      .sort(
        (a, b) =>
          (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0),
      ),
  };
}
export function normalizeConnections(
  rows: BrokerageAuthorization[],
): ConnectionView[] {
  return rows.map((c) => ({
    name: c.name || c.brokerage?.display_name || "Brokerage connection",
    status:
      c.disabled === true
        ? "Disabled"
        : c.disabled === false
          ? "Connected"
          : "Unknown",
  }));
}
