import "server-only";
import type {
  UniversalActivity,
  AccountOrderRecord,
} from "snaptrade-typescript-sdk";
import {
  currencyField,
  decimalField,
  financialDate,
  textField,
} from "@/lib/financial/fields";
import { nonEmptyText } from "@/lib/financial/validation";
import {
  unavailableDelta,
  type DataIssue,
  type MoneyField,
  type Provenance,
} from "@/lib/financial/types";
import { normalizeOptionContract } from "@/lib/options/contracts";
import type { OptionAction } from "@/lib/options/types";
import type {
  NormalizedTransaction,
  SourceScalar,
} from "@/lib/financial/transactions";
import type { NormalizedOrder } from "@/lib/financial/orders";
export type { NormalizedTransaction } from "@/lib/financial/transactions";
const sourceScalar = (value: unknown): SourceScalar =>
  typeof value === "string" ||
  (typeof value === "number" && Number.isFinite(value))
    ? value
    : null;
const optionActions = new Set([
  "BUY_TO_OPEN",
  "BUY_TO_CLOSE",
  "SELL_TO_OPEN",
  "SELL_TO_CLOSE",
]);
export function normalizeTransaction(
  t: UniversalActivity,
  accountId: string,
): NormalizedTransaction {
  const id = nonEmptyText(t.id),
    source = (field: string): Provenance => ({
      provider: "snaptrade",
      field: `activity.${field}`,
      ...(id ? { recordId: id } : {}),
    });
  const currency = currencyField(t.currency?.code, source("currency.code"));
  const money = (value: unknown, field: string): MoneyField => ({
    amount: decimalField(value, source(field)),
    currency,
  });
  const unsupported = (field: string): MoneyField => ({
    amount: {
      status: "unsupported",
      value: null,
      provenance: source(field),
      reason:
        "The source reports a signed amount and a separate optional fee, without a guaranteed gross/net convention.",
    },
    currency,
  });
  const tradeDate = financialDate(t.trade_date),
    settlementDate = financialDate(t.settlement_date);
  const type = nonEmptyText(t.type) || "UNKNOWN",
    optionAction = optionActions.has(t.option_type || "")
      ? (t.option_type as OptionAction)
      : "unknown";
  const issues: DataIssue[] = [];
  if (!id)
    issues.push({
      code: "missing_transaction_id",
      field: "id",
      severity: "blocking",
    });
  if (t.account?.id && t.account.id !== accountId)
    issues.push({
      code: "account_scope_mismatch",
      field: "account",
      severity: "blocking",
    });
  if (tradeDate.precision === "invalid")
    issues.push({
      code: "invalid_trade_date",
      field: "trade_date",
      severity: "blocking",
    });
  if (
    optionAction !== "unknown" &&
    ((optionAction.startsWith("BUY") && type !== "BUY") ||
      (optionAction.startsWith("SELL") && type !== "SELL"))
  )
    issues.push({
      code: "option_action_conflict",
      field: "option_type",
      severity: "blocking",
    });
  const option = t.option_symbol
    ? normalizeOptionContract(
        {
          id: t.option_symbol.id,
          symbol: t.option_symbol.ticker,
          type: t.option_symbol.option_type,
          strike: t.option_symbol.strike_price,
          expiration: t.option_symbol.expiration_date,
          underlyingId: t.option_symbol.underlying_symbol?.id,
          underlyingTicker: t.option_symbol.underlying_symbol?.symbol,
          referenceDay: tradeDate.day,
        },
        "activity",
      )
    : null;
  return {
    id,
    accountId,
    securityId: nonEmptyText(t.symbol?.id),
    ticker: nonEmptyText(t.symbol?.symbol),
    securityCurrency: nonEmptyText(t.symbol?.currency?.code),
    type,
    direction: type === "BUY" ? "buy" : type === "SELL" ? "sell" : "unknown",
    optionAction,
    option,
    optionRelated:
      !!t.option_symbol || !!t.option_type || type.startsWith("OPTION"),
    tradeDate,
    settlementDate,
    quantity: decimalField(t.units, source("units")),
    price: money(t.price, "price"),
    cashFlow: money(t.amount, "amount"),
    fee: money(t.fee, "fee"),
    grossAmount: unsupported("gross_amount"),
    netAmount: unsupported("net_amount"),
    cashConvention: "unspecified",
    fxRate: decimalField(t.fx_rate, source("fx_rate")),
    externalReferenceId: nonEmptyText(t.external_reference_id),
    description:
      nonEmptyText(t.description) ||
      nonEmptyText(t.symbol?.symbol) ||
      "Account activity",
    entryDelta: unavailableDelta(),
    issues,
    sourceValues: {
      units: sourceScalar(t.units),
      price: sourceScalar(t.price),
      amount: sourceScalar(t.amount),
      fee: sourceScalar(t.fee),
      fxRate: sourceScalar(t.fx_rate),
    },
  };
}
export function normalizeOrderRecord(
  o: AccountOrderRecord,
  accountId: string,
): NormalizedOrder {
  const p = (field: string): Provenance => ({
    provider: "snaptrade",
    field: `order.${field}`,
  });
  return {
    accountId,
    id: nonEmptyText(o.brokerage_order_id),
    groupId: nonEmptyText(o.brokerage_group_order_id),
    role: o.order_role || null,
    status: nonEmptyText(o.status),
    action: nonEmptyText(o.action),
    symbol:
      nonEmptyText(o.symbol) ||
      nonEmptyText(o.universal_symbol?.symbol) ||
      nonEmptyText(o.option_symbol?.ticker),
    quantity: decimalField(o.total_quantity, p("total_quantity")),
    filledQuantity: decimalField(o.filled_quantity, p("filled_quantity")),
    openQuantity: decimalField(o.open_quantity, p("open_quantity")),
    canceledQuantity: decimalField(o.canceled_quantity, p("canceled_quantity")),
    executionPrice: {
      amount: decimalField(o.execution_price, p("execution_price")),
      currency: currencyField(o.quote_currency?.code, p("quote_currency.code")),
    },
    placedAt: financialDate(o.time_placed),
    executedAt: financialDate(o.time_executed),
    updatedAt: financialDate(o.time_updated),
    option: o.option_symbol
      ? normalizeOptionContract(
          {
            id: o.option_symbol.id,
            symbol: o.option_symbol.ticker,
            type: o.option_symbol.option_type,
            strike: o.option_symbol.strike_price,
            expiration: o.option_symbol.expiration_date,
            underlyingId: o.option_symbol.underlying_symbol?.id,
            underlyingTicker: o.option_symbol.underlying_symbol?.symbol,
            referenceDay: financialDate(o.time_placed).day,
          },
          "order",
        )
      : null,
    recordKind: "order-snapshot" as const,
    executionIdentity: textField(null, p("execution_id")),
  };
}
