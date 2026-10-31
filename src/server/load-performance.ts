import "server-only";
import type {
  AccountValueHistoryResponse,
  RateOfReturnResponse,
} from "snaptrade-typescript-sdk";
import type {
  AccountData,
  AccountHistory,
  PerformanceAccount,
  ReportedReturn,
  Result,
} from "@/lib/types";
import { getSnaptrade, type ReadClient } from "./snaptrade";
import { numeric } from "./normalize";
import { historyDate } from "@/lib/performance/performance";
import { loadAccountFunding } from "./load-account-funding";
export function normalizeHistory(
  raw: AccountValueHistoryResponse,
): AccountHistory {
  if (!raw.currency || !/^[A-Z]{3}$/.test(raw.currency))
    throw Error("History currency unavailable");
  const points = new Map<string, number>();
  let omittedPoints = 0;
  for (const p of raw.history || []) {
    const date = typeof p.date === "string" ? historyDate(p.date) : null;
    const value = numeric(p.total_value);
    if (!date || value === null) {
      omittedPoints++;
      continue;
    }
    points.set(date, value);
  }
  return {
    currency: raw.currency,
    points: [...points]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value })),
    omittedPoints,
  };
}
export function normalizeReturns(raw: RateOfReturnResponse): ReportedReturn[] {
  return (raw.data || []).flatMap((r) => {
    const percent = numeric(r.return_percent);
    return r.timeframe && percent !== null
      ? [{ timeframe: r.timeframe, percent, asOf: r.created_date || null }]
      : [];
  });
}
async function read<T, U>(
  request: () => Promise<{ data: T }>,
  normalize: (data: T) => U,
  kind: string,
): Promise<Result<U>> {
  try {
    return { status: "ok", data: normalize((await request()).data) };
  } catch (error) {
    const status = (error as { response?: { status?: number } } | null)
      ?.response?.status;
    return {
      status: "error",
      message:
        status === 429
          ? `${kind} rate limit reached. Wait before refreshing.`
          : status === 403 && kind === "History"
            ? "History access denied. Check your SnapTrade permissions and enable the free Account Value History add-on if needed."
            : `${kind} is unavailable for this account. Your brokerage may not provide this data, or the history add-on may not be enabled.`,
    };
  }
}
export async function loadPerformance(
  accounts: AccountData[],
  client:
    | (Pick<ReadClient, "history" | "returns"> &
        Partial<Pick<ReadClient, "transactionPage">>)
    | null = getSnaptrade(),
  options: { reportedReturns?: boolean } = {},
): Promise<PerformanceAccount[]> {
  if (!client) return [];
  const results: PerformanceAccount[] = await Promise.all(
    accounts.map(async ({ account }) => {
      const [history, returns] = await Promise.all([
        read(() => client.history(account.id), normalizeHistory, "History"),
        options.reportedReturns === false
          ? Promise.resolve<Result<ReportedReturn[]>>({
              status: "ok",
              data: [],
            })
          : read(
              () => client.returns(account.id),
              normalizeReturns,
              "Reported returns",
            ),
      ]);
      return {
        id: account.id,
        name: account.name,
        suffix: account.suffix,
        history,
        returns,
      };
    }),
  );
  let rateLimited = results.some((a) =>
    [a.history, a.returns].some(
      (r) => r.status === "error" && r.message.includes("rate limit"),
    ),
  );
  // Fetch only where a chart exists, sequentially to avoid transaction bursts.
  for (const account of results) {
    if (account.history.status !== "ok" || !account.history.data.points.length)
      continue;
    account.funding =
      rateLimited || !client.transactionPage
        ? {
            status: "error",
            message: rateLimited
              ? "Funding history not requested after a rate limit. Wait before refreshing."
              : "Funding history is unavailable.",
          }
        : await loadAccountFunding(
            account.id,
            {
              transactionPage: client.transactionPage,
            },
            accounts.find((a) => a.account.id === account.id)?.account
              .transactionSync,
          );
    if (
      account.funding.status === "error" &&
      account.funding.message.includes("rate limit")
    )
      rateLimited = true;
  }
  return results;
}
