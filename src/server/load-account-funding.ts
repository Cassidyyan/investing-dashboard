import "server-only";
import type { UniversalActivity } from "snaptrade-typescript-sdk";
import type { AccountFunding, FundingEvent, Result } from "@/lib/types";
import { historyDate } from "@/lib/performance/performance";
import { numeric } from "./normalize";
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
): FundingEvent | null {
  if (internalTypes.has(t.type || "")) return null;
  const date = historyDate(t.trade_date || t.settlement_date || "");
  const currency = t.currency?.code || null;
  const amount = numeric(t.amount);
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
  const events: FundingEvent[] = [],
    seen = new Set<string>();
  try {
    // Full available history, not the recent 25-activity display. Bound requests
    // and reject incomplete pagination rather than calculate on partial deposits.
    for (let page = 0; page < 10; page++) {
      const offset = page * 1000;
      const { data } = await client.transactionPage(accountId, offset, 1000);
      if (!Array.isArray(data.data)) throw Error("Invalid transaction page");
      for (const transaction of data.data) {
        if (!transaction.id || seen.has(transaction.id))
          throw Error("Uncertain transaction coverage");
        seen.add(transaction.id);
        const event = normalizeFundingEvent(transaction);
        if (event) events.push(event);
      }
      const total = numeric(data.pagination?.total);
      if (
        data.pagination?.total != null &&
        (total === null || !Number.isInteger(total))
      )
        throw Error("Invalid pagination total");
      if (total !== null && (total < offset + data.data.length || total < 0))
        throw Error("Invalid pagination");
      if (
        (total !== null && offset + data.data.length === total) ||
        (total === null && data.data.length < 1000)
      )
        return { status: "ok", data: { events } };
      if (data.data.length !== 1000) throw Error("Incomplete pagination");
    }
    return {
      status: "error",
      message:
        "Funding history exceeds the 10,000-transaction limit; return estimates are unavailable.",
    };
  } catch (error) {
    const status = (error as { response?: { status?: number } } | null)
      ?.response?.status;
    return {
      status: "error",
      message:
        status === 429
          ? "Funding history rate limit reached. Wait before refreshing."
          : "Complete available funding history could not be loaded. Try Refresh.",
    };
  }
}
