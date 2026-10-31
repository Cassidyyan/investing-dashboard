import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HistoryCoverage } from "@/components/shared/HistoryCoverage";
import type { TransactionCoverage } from "@/lib/financial/history-coverage";
const coverage: TransactionCoverage = {
  status: "complete",
  records: 12000,
  rawRecords: 12001,
  expectedTotal: 12001,
  pages: 13,
  earliest: "2014-01-01",
  latest: "2026-10-30",
  retrievedAt: "2026-10-31T16:00:00Z",
  cache: "cached",
  duplicates: 1,
  errorCode: null,
  optionRecords: 10,
  events: { assignment: 1, exercise: 0, expiration: 2 },
  fields: [{ field: "Trade fee", applicable: 20, missing: 3, invalid: 0 }],
};
it("separates API completion, unknown sync and brokerage lifetime coverage without financial values", () => {
  const html = renderToStaticMarkup(
    <HistoryCoverage rows={[{ label: "Synthetic account", coverage }]} />,
  );
  expect(html).toContain("Complete available pages");
  expect(html).toContain("Brokerage lifetime coverage remains unverified");
  expect(html).toContain("Unknown");
  expect(html).toContain("Reused snapshot");
  expect(html).toContain("2014-01-01");
  expect(html).not.toContain("100%");
  expect(html).not.toContain("USD");
});
it("keeps partial errors and earlier-history warnings visible", () => {
  const html = renderToStaticMarkup(
    <HistoryCoverage
      rows={[
        {
          label: "Synthetic account",
          coverage: {
            ...coverage,
            status: "partial",
            errorCode: "time_budget_exceeded",
          },
          sync: {
            initialSyncCompleted: false,
            firstTransactionDate: "2010-01-01",
            lastSuccessfulSync: null,
            invalidMetadata: false,
          },
        },
      ]}
    />,
  );
  expect(html).toContain("dependent returns unavailable");
  expect(html).toContain("Possible earlier history");
  expect(html).toContain("Incomplete");
});
