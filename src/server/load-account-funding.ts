import "server-only";
import type { UniversalActivity } from "snaptrade-typescript-sdk";
import type { AccountFunding, FundingEvent, Result } from "@/lib/types";
import { historyDate } from "@/lib/performance/performance";
import { numeric } from "./normalize";
import {
  transactionRecords,
  TransactionCoverageError,
} from "./transaction-pages";
import { normalizeTransaction } from "./normalize-transactions";
import { decimalNumber } from "@/lib/financial/decimal";
import type { ReadClient } from "./snaptrade";

// These change investments/income within the account, not external funding.
const internalTypes = new Set([
  "BUY",
  "SELL",
  "DIVIDEND",
  "SUBSTITUTE_DIVIDEND",
  "REI",
  "STOCK_DIVIDEND",
  "INTEREST",
  "FEE",
  "TAX",
  "SPLIT",
  "OPTIONEXPIRATION",
  "OPTIONASSIGNMENT",
  "OPTIONEXERCISE",
]);
export function normalizeFundingEvent(
  t: UniversalActivity,
  accountId = t.account?.id || "",
): FundingEvent | null {
  if (internalTypes.has(t.type || "")) return null;
  const transaction = normalizeTransaction(t, accountId);
  const date = historyDate(t.trade_date || t.settlement_date || "");
  const currency = transaction.cashFlow.currency.value;
  const amount = decimalNumber(transaction.cashFlow.amount.value);
  const base = { date, amount, currency };
  if (!["CONTRIBUTION", "WITHDRAWAL"].includes(t.type || ""))
    return {
      ...base,
      issue:
        "An unclassified activity or transfer needs funding reconciliation.",
    };
  if (!date || amount === null || !currency)
    return {
      ...base,
      issue: "A deposit or withdrawal is missing its date, amount or currency.",
    };
  if (
    t.symbol ||
    t.option_symbol ||
    t.currency_universal_symbol ||
    numeric(t.fee)
  )
    return {
      ...base,
      issue:
        "An in-kind, non-cash or fee-bearing funding transaction needs reconciliation.",
    };
  if (
    (t.type === "CONTRIBUTION" && amount < 0) ||
    (t.type === "WITHDRAWAL" && amount > 0)
  )
    return {
      ...base,
      issue: "A funding transaction has an unexpected amount direction.",
    };
  return base;
}

export async function loadAccountFunding(
  accountId: string,
  client: Pick<ReadClient, "transactionPage">,
): Promise<Result<AccountFunding>> {
  const events: FundingEvent[] = [];
  try {
    for await (const transaction of transactionRecords(accountId, client)) {
      const event = normalizeFundingEvent(transaction, accountId);
      if (event) events.push(event);
    }
    return { status: "ok", data: { events } };
  } catch (error) {
    const status = (error as { response?: { status?: number } } | null)
      ?.response?.status;
    return {
      status: "error",
      message:
        error instanceof TransactionCoverageError &&
        error.code === "history_limit_exceeded"
          ? "Funding history exceeds the 10,000-transaction limit; return estimates are unavailable."
          : status === 429
            ? "Funding history rate limit reached. Wait before refreshing."
            : "Complete available funding history could not be loaded. Try Refresh.",
    };
  }
}
