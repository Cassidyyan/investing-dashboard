import "server-only";
import type { UniversalActivity } from "snaptrade-typescript-sdk";
import type { AccountData } from "@/lib/types";
import type {
  SecurityTransaction,
  TransactionHistory,
} from "@/lib/returns/holding-returns";
import { historyDate } from "@/lib/performance/performance";
import { normalizeTransaction } from "./normalize-transactions";
import { decimalNumber } from "@/lib/financial/decimal";
import {
  transactionRecords,
  TransactionCoverageError,
} from "./transaction-pages";
import { numeric } from "./normalize";
import { getSnaptrade, type ReadClient } from "./snaptrade";

const types = new Set(["cs", "ad", "ps", "et", "cef", "oef", "ut", "pm"]);
export function normalizeSecurityTransaction(
  t: UniversalActivity,
  accountId = t.account?.id || "",
): SecurityTransaction | null {
  const reported = normalizeTransaction(t, accountId);
  if (reported.optionRelated || t.type === "INTEREST" || !t.symbol?.symbol)
    return null;
  if (t.symbol.type?.code && !types.has(t.symbol.type.code)) return null;
  const rawDate = t.trade_date || t.settlement_date || "";
  const shareOnlyTransfer =
    t.type === "TRANSFER" &&
    numeric(t.amount) === 0 &&
    !numeric(t.fee) &&
    !t.currency_universal_symbol;
  // A zero-cash share transfer has no settlement cash to convert. Some brokers
  // default its currency field to CAD even when the security itself trades in USD.
  const currency =
    (shareOnlyTransfer ? t.symbol.currency?.code : null) ||
    t.currency?.code ||
    "Unknown";
  const units = numeric(t.units);
  const settlement = ["OPTIONASSIGNMENT", "OPTIONEXERCISE"].includes(
    reported.type,
  );
  const amount = decimalNumber(reported.cashFlow.amount.value);
  const type =
    settlement &&
    units !== null &&
    units !== 0 &&
    amount !== null &&
    amount !== 0
      ? amount < 0
        ? "BUY"
        : "SELL"
      : reported.type;
  return {
    sourceRecord: reported,
    id: t.id || "",
    symbol: t.symbol.symbol,
    currency,
    date: historyDate(rawDate),
    order: rawDate,
    type,
    // Brokerages may report sales as negative units. BUY/SELL supplies direction;
    // ownership and missing-basis checks still distinguish sales from shorts.
    units:
      (type === "SELL" || settlement) && units !== null
        ? Math.abs(units)
        : units,
    price: decimalNumber(reported.price.amount.value),
    amount,
    fee: decimalNumber(reported.fee.amount.value),
    securityCurrency: t.symbol.currency?.code,
    fxConvertible:
      !t.currency_universal_symbol &&
      ["CAD", "USD"].includes(currency) &&
      ["CAD", "USD"].includes(t.symbol.currency?.code || "") &&
      currency !== t.symbol.currency?.code &&
      ["BUY", "SELL", "DIVIDEND", "SUBSTITUTE_DIVIDEND", "FEE", "TAX"].includes(
        type,
      ),
    issue:
      t.currency_universal_symbol ||
      (t.symbol.currency?.code && t.symbol.currency.code !== currency)
        ? "Transaction settlement currency differs from security currency; historical FX reconciliation is required."
        : undefined,
    ...(settlement
      ? {
          note: "Underlying shares from a reported option assignment/exercise settlement; recorded stock cash establishes purchase cost or sale proceeds. Option premium is accounted for separately.",
        }
      : {}),
  };
}
export async function loadHoldingTransactions(
  accounts: AccountData[],
  client: Pick<ReadClient, "transactionPage"> | null = getSnaptrade(),
): Promise<TransactionHistory[]> {
  const results: TransactionHistory[] = [];
  let rateLimited = false;
  // Sequential pages/accounts limit request bursts. No polling, retries, or disk cache.
  for (const { account } of accounts) {
    const history: TransactionHistory = {
      accountId: account.id,
      transactions: [],
      sourceRecords: [],
      issues: [],
      warnings: [],
    };
    results.push(history);
    if (rateLimited) {
      history.issues.push(
        "History not requested after a rate limit. Wait before refreshing.",
      );
      continue;
    }
    if (!client) {
      history.issues.push("Configure SnapTrade locally to load transactions.");
      continue;
    }
    try {
      for await (const t of transactionRecords(
        account.id,
        client,
        (coverage) => {
          history.coverage = coverage;
        },
        account.transactionSync,
      )) {
        const normalized = normalizeSecurityTransaction(t, account.id);
        history.sourceRecords!.push(
          normalized?.sourceRecord || normalizeTransaction(t, account.id),
        );
        if (normalized) history.transactions.push(normalized);
        else if (
          !t.option_symbol &&
          !t.option_type &&
          !t.type?.startsWith("OPTION") &&
          !t.symbol?.symbol &&
          [
            "BUY",
            "SELL",
            "DIVIDEND",
            "SUBSTITUTE_DIVIDEND",
            "REI",
            "SPLIT",
            "TRANSFER",
            "EXTERNAL_ASSET_TRANSFER_IN",
            "EXTERNAL_ASSET_TRANSFER_OUT",
          ].includes(t.type || "")
        )
          history.warnings!.push(
            "Some transactions have no ticker and cannot be attributed. Estimates cover matched records only; older trades, transfers, or dividends may be missing.",
          );
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } } | null)
        ?.response?.status;
      if (status === 429) rateLimited = true;
      history.issues.push(
        status === 429
          ? "Transaction history rate limit reached. Wait before refreshing."
          : error instanceof TransactionCoverageError &&
              ["conflicting_id", "no_progress"].includes(error.code)
            ? "History changed or repeated during pagination; refresh later."
            : "Transaction history is incomplete or unavailable.",
      );
    }
    if (
      account.transactionSync?.initialSyncCompleted === false ||
      account.transactionSync?.invalidMetadata
    )
      history.issues.push(
        "Transaction synchronization is incomplete or invalid; verify source coverage before ranking returns.",
      );
    history.issues = [...new Set(history.issues)];
    history.warnings = [...new Set(history.warnings)];
  }
  return results;
}
