import { getConfig } from "./config";
import "server-only";

// Convert SnapTrade responses into display objects; missing amounts remain null, not zero.

import { applyOptionsCurrency } from "@/lib/options/currency";
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
import { numeric, nonEmptyText, calendarDay } from "@/lib/financial/validation";
import {
  normalizeTransaction,
  normalizeOrderRecord,
} from "./normalize-transactions";
import { positionValues } from "@/lib/financial/position-values";
import { decimalNumber } from "@/lib/financial/decimal";
import { normalizeOptionContract } from "@/lib/options/contracts";
import { transactionSync } from "./history-quality";
export { numeric } from "@/lib/financial/validation";
export function normalizeAccount(a: Account): AccountView {
  if (!a || typeof a !== "object") throw new Error("Account data unavailable.");
  const sync = a.sync_status?.holdings;
  if (!nonEmptyText(a.id)) throw new Error("Account identity unavailable.");
  const rawSync = sync?.last_successful_sync;
  const syncedAt = rawSync && calendarDay(rawSync) ? rawSync : null;
  return {
    id: a.id,
    transactionSync: transactionSync(a.sync_status?.transactions),
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
      sync?.holdings_unavailable === true ||
      (!!rawSync && !syncedAt),
    stale: !!syncedAt && Date.now() - Date.parse(syncedAt) > 36 * 3600000,
  };
}
export function normalizeBalances(rows: Balance[]): BalanceView[] {
  if (!Array.isArray(rows)) throw new Error("Balance records unavailable.");
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
  if (!data || !Array.isArray(data.results))
    throw new Error("Position records unavailable.");
  return {
    asOf: data.data_freshness?.as_of || null,
    rows: data.results.map((p) => {
      const i = p.instrument;
      const units = numeric(p.units),
        rawPrice = numeric(p.price);
      const price = rawPrice !== null && rawPrice >= 0 ? rawPrice : null;
      const currency =
        (i.kind === "option" || i.kind === "future_option") &&
        getConfig().settings.optionsCurrency === "USD"
          ? "USD"
          : p.currency ||
            ("currency" in i && typeof i.currency === "string"
              ? i.currency
              : null);
      // SnapTrade labels this CAD-listed trust as "other". Its issuer confirms
      // per-unit pricing: https://sprott.com/media/xcilumow/phys.pdf
      // Keep this exception narrow; arbitrary "other" instruments may need
      // valuation conventions that units × price cannot represent.
      const knownUnitPricedTrust =
        i.kind === "other" && i.symbol === "PHYS.TO" && currency === "CAD";
      const multiplier =
        i.kind === "option"
          ? numeric(i.multiplier) !== null && numeric(i.multiplier)! > 0
            ? numeric(i.multiplier)
            : null
          : ["stock", "adr", "cef", "etf", "mutualfund", "crypto"].includes(
                i.kind,
              ) || knownUnitPricedTrust
            ? 1
            : null;
      const exact = positionValues({
        units: p.units,
        price: p.price,
        cost: p.cost_basis,
        multiplier:
          i.kind === "option" && multiplier !== null
            ? i.multiplier
            : multiplier,
      });
      const computed = decimalNumber(exact.marketValue);
      const rawCost = numeric(p.cost_basis);
      const averageCost = rawCost !== null && rawCost >= 0 ? rawCost : null;
      const unrealizedReturn = currency
        ? decimalNumber(exact.unrealizedReturn)
        : null;
      const invested = decimalNumber(exact.invested);
      const rawPercent =
        unrealizedReturn !== null &&
        invested !== null &&
        Number.isFinite(invested) &&
        invested > 0
          ? (unrealizedReturn / invested) * 100
          : null;
      const contract =
        i.kind === "option" || i.kind === "future_option"
          ? normalizeOptionContract(
              {
                id: i.id,
                symbol: i.symbol,
                type: i.option_type,
                strike: i.strike_price,
                expiration: i.expiration_date,
                multiplier: i.multiplier,
                currency,
                underlyingId: i.underlying?.id,
                underlyingTicker: i.underlying?.symbol,
                referenceDay: calendarDay(data.data_freshness?.as_of),
              },
              "position",
            )
          : null;
      return {
        instrumentId: i.id,
        optionDetails:
          i.kind === "option" || i.kind === "future_option"
            ? {
                type: contract?.type.value ?? null,
                strike: {
                  amount: decimalNumber(contract?.strike.amount.value ?? null),
                  currency,
                },
                expiration: contract?.expiration.value ?? null,
                multiplier: decimalNumber(contract?.multiplier.value ?? null),
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
export function normalizeOrders(
  data: RecentOrdersResponse,
  accountId = "",
): OrderView[] {
  if (!data || !Array.isArray(data.orders))
    throw new Error("Order records unavailable.");
  return data.orders
    .map((o) => {
      const order = normalizeOrderRecord(o, accountId);
      return {
        symbol: order.symbol || "Unknown",
        action: order.action || "Unknown",
        status: order.status || "Unknown",
        quantity: decimalNumber(order.quantity.value),
        placedAt: order.placedAt.day ? order.placedAt.raw : null,
      };
    })
    .sort(
      (a, b) =>
        (Date.parse(b.placedAt || "") || 0) -
        (Date.parse(a.placedAt || "") || 0),
    );
}
export function normalizeActivities(
  data: PaginatedUniversalActivity,
  accountId = "",
): {
  rows: ActivityView[];
  total: number | null;
} {
  if (!data || !Array.isArray(data.data))
    throw new Error("Activity records unavailable.");
  return {
    total: numeric(data.pagination?.total),
    rows: data.data
      .map((t) => {
        const row = applyOptionsCurrency(
          normalizeTransaction(t, accountId),
          getConfig().settings.optionsCurrency,
        );
        return {
          description: row.description,
          type: row.type,
          date: row.tradeDate.day
            ? row.tradeDate.raw
            : !t.trade_date && row.settlementDate.day
              ? row.settlementDate.raw
              : null,
          amount: {
            amount: decimalNumber(row.cashFlow.amount.value),
            currency: row.cashFlow.currency.value,
          },
        };
      })
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
