import type { OptionsData } from "@/lib/options/analytics-types";
import { parseWealthsimpleActivity } from "@/lib/imports/wealthsimple-activity";
import { csvOptionHistory } from "@/lib/imports/csv-option-history";
import { buildOptionsLedger } from "@/lib/options/ledger";

export function createCsvReconciledPreview(): OptionsData {
  const parsed = parseWealthsimpleActivity(
    [
      "effective_date,effective_time,account_id,activity_type,activity_sub_type,symbol,currency,quantity,unit_price,commission,net_cash_amount,direction",
      "2026-09-01,10:00:00,SYNTHETIC_ACCOUNT,Trade,SELL,SYNTH261218C00100000,USD,-1,1,2,98,SHORT",
      "2026-09-02,10:00:00,SYNTHETIC_ACCOUNT,Trade,BUY,SYNTH261218C00100000,USD,1,0.4,1,-41,SHORT",
    ].join("\n"),
  );
  const csv = csvOptionHistory(
    [{ accountId: "sample-options", records: [], issues: [] }],
    parsed.activities,
    new Map([["SYNTHETIC_ACCOUNT", new Set(["sample-options"])]]),
  );
  return {
    ...buildOptionsLedger(csv.histories, "2026-10-31", "USD"),
    accounts: [
      { id: "sample-options", name: "Sample options account", suffix: "0000" },
    ],
    openPositions: [],
    updatedAt: "2026-10-31T16:00:00Z",
    configured: true,
    error: null,
    reconnect: false,
    importReconciliation: {
      mappedAccounts: 1,
      matched: 2,
      added: 0,
      conflicts: 0,
      unmatched: 0,
      ...csv.counts,
    },
    importPreview: {
      files: 1,
      records: 2,
      accounts: 1,
      earliest: parsed.earliest,
      latest: parsed.latest,
      warnings: [],
      possibleDuplicates: 0,
      rows: parsed.rows.map((r, i) => ({
        ...r.activity,
        id: `synthetic-csv-${i}`,
        account: "CSV account 1",
        source: "Export 1",
        possibleDuplicate: false,
      })),
    },
  };
}
