import "server-only";
import { normalizeTransaction } from "@/server/normalize-transactions";
import { buildOptionsLedger } from "@/lib/options/ledger";
import type { OptionsData } from "@/lib/options/analytics-types";
import { createImportPreview } from "./wealthsimple-import-preview";
import { createCsvReconciledPreview } from "./csv-reconciled-preview";
export const optionsPreviews = [
  "csv",
  "sample",
  "loading",
  "empty",
  "error",
  "hidden",
] as const;
export type OptionsPreview = (typeof optionsPreviews)[number];
export function createOptionsPreview(state: OptionsPreview): OptionsData {
  if (state === "csv") return createCsvReconciledPreview();
  const records: ReturnType<typeof normalizeTransaction>[] = [];
  const add = (
    id: string,
    ticker: string,
    action: string,
    qty: number,
    amount: number,
    date: string,
    expiration = "2026-12-18",
    fee: number | null = 0,
  ) =>
    records.push(
      normalizeTransaction(
        {
          id,
          type: action.startsWith("BUY") ? "BUY" : "SELL",
          option_type: action,
          units: qty,
          amount,
          price: Math.abs(amount) / qty / 100,
          fee,
          trade_date: date,
          currency: { code: "USD" },
          option_symbol: {
            ticker: `${ticker}261218P00100000`,
            option_type: "PUT",
            strike_price: 100,
            expiration_date: expiration,
            underlying_symbol: { symbol: ticker },
          },
        } as Parameters<typeof normalizeTransaction>[0],
        "sample-options",
      ),
    );
  if (state !== "empty" && state !== "error") {
    add("a1", "ALPHA", "SELL_TO_OPEN", 2, 480, "2026-08-03T14:00:00Z");
    add("a2", "ALPHA", "BUY_TO_CLOSE", 1, -100, "2026-08-10T14:00:00Z");
    add("a3", "ALPHA", "BUY_TO_CLOSE", 1, -80, "2026-09-02T14:00:00Z");
    add("b1", "BETA", "BUY_TO_OPEN", 1, -180, "2026-09-03T14:00:00Z");
    add("b2", "BETA", "SELL_TO_CLOSE", 1, 100, "2026-09-12T14:00:00Z");
    add("c1", "GAMMA", "BUY_TO_OPEN", 1, -120, "2026-09-15T14:00:00Z");
    add("c2", "GAMMA", "SELL_TO_CLOSE", 1, 240, "2026-10-02T14:00:00Z");
    add("d1", "DELTA", "SELL_TO_OPEN", 3, 330, "2026-10-06T14:00:00Z");
    add("d2", "DELTA", "BUY_TO_CLOSE", 1, -40, "2026-10-12T14:00:00Z");
    add(
      "e1",
      "OMEGA",
      "SELL_TO_OPEN",
      1,
      150,
      "2026-10-14T14:00:00Z",
      "2026-12-18",
      null,
    );
    // Source-labelled CAD sample verifies the USD-only assumption without FX.
    const start = records.length;
    add("cad1", "MAPLE", "BUY_TO_OPEN", 1, -100, "2026-09-10T14:00:00Z");
    add("cad2", "MAPLE", "SELL_TO_CLOSE", 1, 160, "2026-10-08T14:00:00Z");
    for (const r of records.slice(start)) {
      r.cashFlow.currency = {
        ...r.cashFlow.currency,
        status: "confirmed",
        value: "CAD",
      };
      r.fee.currency = { ...r.fee.currency, status: "confirmed", value: "CAD" };
      r.price.currency = {
        ...r.price.currency,
        status: "confirmed",
        value: "CAD",
      };
    }
  }
  const data = buildOptionsLedger(
    [{ accountId: "sample-options", records, issues: [] }],
    "2026-10-31",
  );
  return {
    ...data,
    importPreview:
      state === "sample" || state === "hidden" ? createImportPreview() : null,
    historyCoverage: records.length
      ? [
          {
            accountId: "sample-options",
            sync: {
              initialSyncCompleted: true,
              firstTransactionDate: "2026-08-03",
              lastSuccessfulSync: "2026-10-31",
              invalidMetadata: false,
            },
            coverage: {
              status: "complete",
              records: records.length,
              rawRecords: records.length,
              expectedTotal: records.length,
              pages: 1,
              earliest: "2026-08-03",
              latest: "2026-10-14",
              retrievedAt: "2026-10-31T16:00:00Z",
              cache: "fresh",
              duplicates: 0,
              errorCode: null,
              optionRecords: records.length,
              events: { assignment: 0, exercise: 0, expiration: 0 },
              fields: [
                {
                  field: "Trade fee",
                  applicable: records.length,
                  missing: 1,
                  invalid: 0,
                },
                {
                  field: "Explicit option multiplier",
                  applicable: records.length,
                  missing: records.length,
                  invalid: 0,
                },
              ],
            },
          },
        ]
      : [],
    accounts:
      state === "empty"
        ? []
        : [
            {
              id: "sample-options",
              name: "Sample options account",
              suffix: "•••• 0000",
            },
          ],
    openPositions:
      state === "sample" || state === "hidden"
        ? [
            {
              accountId: "sample-options",
              ticker: "DELTA",
              symbol: "DELTA261218P00100000",
              right: "PUT",
              quantity: -2,
              currency: "USD",
              value: -160,
            },
          ]
        : [],
    updatedAt: "2026-10-31T16:00:00Z",
    configured: true,
    error:
      state === "error"
        ? "Synthetic connection error. No brokerage requests were made."
        : null,
    reconnect: state === "error",
  };
}
