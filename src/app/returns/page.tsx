import { selectedPreview, previewsEnabled } from "@/server/config";
import { loadPortfolio } from "@/server/load-portfolio";
import { loadHoldingTransactions } from "@/server/load-holding-returns";
import { calculateHoldingReturns } from "@/lib/returns/holding-returns";
import { Suspense } from "react";
import { ReturnsLoading } from "@/components/returns/ReturnsLoading";
import {
  createReturnsPreview,
  returnsPreviews,
} from "@/dev/previews/returns-preview";
import type { ReturnsPreview } from "@/components/returns/HoldingReturnsDashboard";
import { HoldingReturnsDashboard } from "@/components/returns/HoldingReturnsDashboard";
import { loadReturnExchangeRates } from "@/server/return-exchange-rates";
import { getSecurityLogoUrl } from "@/server/security-logo";
import { loadWealthsimpleDataset } from "@/server/wealthsimple-import";
import { reconcileHoldingImport } from "@/server/reconcile-holding-import";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function HoldingReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview: requested } = await searchParams;
  const preview = selectedPreview(requested);
  if (previewsEnabled() && returnsPreviews.includes(preview as ReturnsPreview))
    return (
      <HoldingReturnsDashboard
        {...createReturnsPreview(preview as ReturnsPreview)}
        preview={preview as ReturnsPreview}
      />
    );
  return (
    <Suspense fallback={<ReturnsLoading />}>
      <LiveHoldingReturns />
    </Suspense>
  );
}
async function LiveHoldingReturns() {
  const portfolio = await loadPortfolio(undefined, ["positions"], "history");
  const accounts =
    portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const histories = await loadHoldingTransactions(accounts);
  const dataset = await loadWealthsimpleDataset();
  const imported = dataset
    ? reconcileHoldingImport(histories, dataset.activities, accounts)
    : null;
  const fx = await loadReturnExchangeRates(imported?.histories || histories);
  const rows = calculateHoldingReturns(accounts, fx.histories).map((row) => ({
    ...row,
    // Lifetime results also include sold securities whose current kind is absent.
    logoUrl: getSecurityLogoUrl(row.symbol, "other"),
  }));
  const issues = histories.flatMap((h) =>
    [...h.issues, ...(h.warnings || [])].map(
      (issue) =>
        `${accounts.find((a) => a.account.id === h.accountId)?.account.name || "Account"}: ${issue}`,
    ),
  );
  const names = Object.fromEntries(
    accounts.flatMap((a) =>
      a.positions.status === "ok"
        ? a.positions.data.rows
            .filter((p) => p.description)
            .map((p) => [p.symbol, p.description])
        : [],
    ),
  );
  return (
    <HoldingReturnsDashboard
      rows={rows}
      importReconciliation={imported?.report}
      historyCoverage={histories.flatMap((h) =>
        h.coverage
          ? [
              {
                label:
                  accounts.find((a) => a.account.id === h.accountId)?.account
                    .name || "Account",
                coverage: h.coverage,
                sync: accounts.find((a) => a.account.id === h.accountId)
                  ?.account.transactionSync,
              },
            ]
          : [],
      )}
      issues={[...new Set([...issues, ...fx.warnings])]}
      portfolio={portfolio}
      names={names}
    />
  );
}
