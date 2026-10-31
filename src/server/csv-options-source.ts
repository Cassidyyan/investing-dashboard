import "server-only";
import { getConfig } from "./config";
import { createHash } from "node:crypto";
import type { WealthsimpleDataset } from "./wealthsimple-dataset";
import { csvOptionHistory } from "@/lib/imports/csv-option-history";
import { buildOptionsLedger } from "@/lib/options/ledger";
import { calendarToday } from "@/lib/performance/performance";
import type { OptionsData } from "@/lib/options/analytics-types";

// A CSV ledger is independent of API availability and account matching. Never
// append API fills: an unproven overlap could otherwise double-count a trade.
export function csvOptionsSource(
  dataset: WealthsimpleDataset,
): OptionsData | null {
  const sourceIds = [
    ...new Set(
      dataset.activities.filter((r) => r.option).map((r) => r.accountId),
    ),
  ].filter(Boolean);
  if (!sourceIds.length) return null;
  const mappings = new Map(
    sourceIds.map((source) => [
      source,
      new Set([
        `csv-account-${createHash("sha256").update(source).digest("hex")}`,
      ]),
    ]),
  );
  const accounts = sourceIds.map((source, index) => ({
    id: [...mappings.get(source)!][0],
    name: dataset.accountAliases?.get(source) || `CSV account ${index + 1}`,
    suffix: "",
  }));
  const csv = csvOptionHistory(
    accounts.map((a) => ({ accountId: a.id, records: [], issues: [] })),
    dataset.activities,
    mappings,
  );
  const ledger = buildOptionsLedger(
    csv.histories,
    calendarToday(),
    getConfig().settings.optionsCurrency,
  );
  if (dataset.activities.some((r) => r.option && !r.accountId))
    ledger.issues.push({
      accountId: "csv-unassigned",
      reason: "CSV option rows without a source account are excluded.",
    });
  if (!ledger.trades.length)
    ledger.issues.push({
      accountId: accounts[0].id,
      reason:
        "CSV options have no usable dated history. Correct the activity dates before using results.",
    });
  return {
    ...ledger,
    accounts,
    openPositions: [],
    updatedAt: new Date().toISOString(),
    configured: true,
    error: null,
    reconnect: false,
    historySource: "csv",
    importPreview: dataset.preview,
    importReconciliation: {
      matched: 0,
      added: 0,
      conflicts: 0,
      unmatched: 0,
      mappedAccounts: 0,
      ...csv.counts,
    },
  };
}
