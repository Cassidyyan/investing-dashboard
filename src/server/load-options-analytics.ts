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
import { csvOptionsSource } from "./csv-options-source";
import type { loadWealthsimpleDataset } from "./wealthsimple-import";
import { getConfig } from "./config";

export async function loadOptionsAnalytics(
  client: ReadClient | null = getSnaptrade(),
  dataset?: Awaited<ReturnType<typeof loadWealthsimpleDataset>>,
): Promise<OptionsData> {
  const portfolio = await loadPortfolio(client, ["positions"], "history");
  const accounts =
    portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const histories: OptionsHistory[] = [];
  const csv = dataset ? csvOptionsSource(dataset) : null;
  let rateLimited = false;
  for (const { account } of csv ? [] : accounts) {
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
  const ledger =
    csv ||
    buildOptionsLedger(
      histories,
      calendarToday(),
      getConfig().settings.optionsCurrency,
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
    historySource: csv ? "csv" : "snaptrade",
    importPreview: dataset?.preview,
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
    accounts: [
      ...(csv?.accounts || []),
      ...accounts.map((a) => ({
        id: a.account.id,
        name: a.account.name,
        suffix: a.account.suffix,
      })),
    ],
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
              currency: p.value.currency,
              value: p.value.amount,
            }))
        : [],
    ),
    updatedAt: portfolio.retrievedAt,
    configured: portfolio.configured || !!csv,
    error:
      !csv && portfolio.accounts.status === "error"
        ? portfolio.accounts.message
        : null,
    snapshotError:
      csv && portfolio.accounts.status === "error"
        ? portfolio.accounts.message
        : csv && reconnect
          ? "The brokerage connection is disabled; its current snapshot may be stale."
          : null,
    reconnect: !csv && reconnect,
  };
}
