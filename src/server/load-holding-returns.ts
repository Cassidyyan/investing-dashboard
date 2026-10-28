import "server-only";
import type { UniversalActivity } from "snaptrade-typescript-sdk";
import type { AccountData } from "@/lib/types";
import type {
  SecurityTransaction,
  TransactionHistory,
} from "@/lib/returns/holding-returns";
import { historyDate } from "@/lib/performance/performance";
import { numeric } from "./normalize";
import { getSnaptrade, type ReadClient } from "./snaptrade";

const types = new Set(["cs", "ad", "ps", "et", "cef", "oef", "ut", "pm"]);
export function normalizeSecurityTransaction(
  t: UniversalActivity,
): SecurityTransaction | null {
  if (
    t.option_symbol ||
    t.option_type ||
    t.type?.startsWith("OPTION") ||
    t.type === "INTEREST" ||
    !t.symbol?.symbol
  )
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
  return {
    id: t.id || "",
    symbol: t.symbol.symbol,
    currency,
    date: historyDate(rawDate),
    order: rawDate,
    type: t.type || "UNKNOWN",
    // Brokerages may report sales as negative units. BUY/SELL supplies direction;
    // ownership and missing-basis checks still distinguish sales from shorts.
    units: t.type === "SELL" && units !== null ? Math.abs(units) : units,
    price: numeric(t.price),
    amount: numeric(t.amount),
    fee: numeric(t.fee),
    securityCurrency: t.symbol.currency?.code,
    fxConvertible:
      !t.currency_universal_symbol &&
      ["CAD", "USD"].includes(currency) &&
      ["CAD", "USD"].includes(t.symbol.currency?.code || "") &&
      currency !== t.symbol.currency?.code &&
      ["BUY", "SELL", "DIVIDEND", "SUBSTITUTE_DIVIDEND", "FEE", "TAX"].includes(
        t.type || "",
      ),
    issue:
      t.currency_universal_symbol ||
      (t.symbol.currency?.code && t.symbol.currency.code !== currency)
        ? "Transaction settlement currency differs from security currency; historical FX reconciliation is required."
        : undefined,
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
    const seen = new Set<string>();
    try {
      let finished = false;
      for (let page = 0; page < 10; page++) {
        const offset = page * 1000;
        const { data } = await client.transactionPage(account.id, offset, 1000);
        if (!Array.isArray(data.data)) throw Error("Malformed history");
        for (const t of data.data) {
          if (!t.id)
            history.issues.push(
              "A transaction lacks an ID; duplicate detection is incomplete.",
            );
          if (t.id && seen.has(t.id)) {
            history.issues.push(
              "History changed or repeated during pagination; refresh later.",
            );
            continue;
          }
          if (t.id) seen.add(t.id);
          const normalized = normalizeSecurityTransaction(t);
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
        const total = numeric(data.pagination?.total);
        if (
          (total !== null && offset + data.data.length >= total) ||
          (total === null && data.data.length < 1000)
        ) {
          finished = true;
          break;
        }
        if (data.data.length !== 1000) throw Error("Incomplete pagination");
      }
      if (!finished)
        history.issues.push(
          "History exceeds the 10,000-transaction limit; lifetime ranking is unavailable for this account.",
        );
    } catch (error) {
      const status = (error as { response?: { status?: number } } | null)
        ?.response?.status;
      if (status === 429) rateLimited = true;
      history.issues.push(
        status === 429
          ? "Transaction history rate limit reached. Wait before refreshing."
          : "Transaction history is incomplete or unavailable.",
      );
    }
    history.issues = [...new Set(history.issues)];
    history.warnings = [...new Set(history.warnings)];
  }
  return results;
}
