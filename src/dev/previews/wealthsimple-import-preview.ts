import { decimal } from "@/lib/financial/decimal";
import type { ActivityImportPreview } from "@/lib/imports/wealthsimple-activity";

export function createImportPreview(): ActivityImportPreview {
  return {
    files: 1,
    records: 27,
    accounts: 2,
    earliest: "2026-10-01",
    latest: "2026-10-27",
    possibleDuplicates: 0,
    warnings: [],
    rows: Array.from({ length: 27 }, (_, i) => ({
      id: `synthetic-csv-${i}`,
      source: "Export 1",
      row: i + 2,
      date: `2026-10-${String(27 - i).padStart(2, "0")}`,
      account: `CSV account ${(i % 2) + 1}`,
      symbol: "SYNTH261218C00100000",
      action: "BUY",
      explicitAction: false,
      side: "LONG",
      candidateAction: "BUY_TO_OPEN",
      currency: "USD",
      quantity: decimal("1"),
      price: decimal("1"),
      commission: decimal("0"),
      netCash: decimal("-100"),
      possibleDuplicate: false,
      issues: ["Opening/closing direction is not supplied."],
    })),
  };
}
