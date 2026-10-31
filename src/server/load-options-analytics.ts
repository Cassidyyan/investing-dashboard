import "server-only";
import type {
  OptionsData,
  OptionsHistory,
} from "@/lib/options/analytics-types";
import { buildOptionsLedger } from "@/lib/options/ledger";
import { loadPortfolio } from "./load-portfolio";
import { transactionRecords } from "./transaction-pages";
import { normalizeTransaction } from "./normalize-transactions";
import { getSnaptrade, type ReadClient } from "./snaptrade";
import { calendarToday } from "@/lib/performance/performance";
import { reconcileCsvActivities } from "@/lib/imports/reconcile-activities";
import type { loadWealthsimpleDataset } from "./wealthsimple-import";
import { csvOptionHistory } from "@/lib/imports/csv-option-history";
import { OPTIONS_CURRENCY } from "@/lib/options/currency";

export async function loadOptionsAnalytics(
  client: ReadClient | null = getSnaptrade(),
  dataset?: Awaited<ReturnType<typeof loadWealthsimpleDataset>>,
): Promise<OptionsData> {
  const portfolio = await loadPortfolio(client, ["positions"], "history");
  const accounts =
    portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const histories: OptionsHistory[] = [];
  let rateLimited = false;
  for (const { account } of accounts) {
    const history: OptionsHistory = {
      accountId: account.id,
      records: [],
      issues: [],
    };
    histories.push(history);
    if (!client || rateLimited) {
      history.issues.push(
        rateLimited
          ? "History not requested after a rate limit. Wait before refreshing."
          : "Configure SnapTrade locally to load history.",
      );
      continue;
    }
    if (
      account.transactionSync?.initialSyncCompleted === false ||
      account.transactionSync?.invalidMetadata
    )
      history.issues.push(
        "Transaction synchronization is incomplete or invalid; verify coverage before using results.",
      );
    try {
      for await (const record of transactionRecords(
        account.id,
        client,
        (coverage) => {
          history.coverage = coverage;
        },
        account.transactionSync,
      ))
        history.records.push(normalizeTransaction(record, account.id));
    } catch (error) {
      const status = (error as { response?: { status?: number } } | null)
        ?.response?.status;
      if (status === 429) rateLimited = true;
      history.issues.push(
        status === 429
          ? "Options history rate limit reached. Wait before refreshing."
          : "Complete available transaction history could not be verified; this account is excluded from realized performance.",
      );
    }
  }
  const reconnect =
    portfolio.connections.status === "ok" &&
    portfolio.connections.data.some((c) => c.status === "Disabled");
  if (reconnect)
    for (const h of histories)
      h.issues.push(
        "Brokerage connection is disabled; cached history may be stale.",
      );
  const reconciled = dataset
    ? reconcileCsvActivities(histories, dataset.activities)
    : null;
  const csv =
    dataset && reconciled
      ? csvOptionHistory(
          reconciled.histories,
          dataset.activities,
          reconciled.accountMappings,
        )
      : null;
  const ledger = buildOptionsLedger(
    csv?.histories || reconciled?.histories || histories,
    calendarToday(),
  );
  for (const row of accounts)
    if (row.positions.status === "error")
      ledger.issues.push({
        accountId: row.account.id,
        reason:
          "Current option positions unavailable; open-position count has partial coverage.",
      });
  return {
    ...ledger,
    ...(reconciled
      ? { importReconciliation: { ...reconciled.report, ...csv?.counts } }
      : {}),
    historyCoverage: histories.flatMap((h) =>
      h.coverage
        ? [
            {
              accountId: h.accountId,
              coverage: h.coverage,
              sync: accounts.find((a) => a.account.id === h.accountId)?.account
                .transactionSync,
            },
          ]
        : [],
    ),
    accounts: accounts.map((a) => ({
      id: a.account.id,
      name: a.account.name,
      suffix: a.account.suffix,
    })),
    openPositions: accounts.flatMap((a) =>
      a.positions.status === "ok"
        ? a.positions.data.rows
            .filter((p) => p.kind === "option" && p.units !== 0)
            .map((p) => ({
              accountId: a.account.id,
              ticker: p.optionDetails?.underlyingSymbol || p.symbol,
              symbol: p.symbol,
              right: p.optionDetails?.type || null,
              quantity: p.units,
              currency: OPTIONS_CURRENCY,
              value: p.value.amount,
            }))
        : [],
    ),
    updatedAt: portfolio.retrievedAt,
    configured: portfolio.configured,
    error:
      portfolio.accounts.status === "error" ? portfolio.accounts.message : null,
    reconnect,
  };
}
