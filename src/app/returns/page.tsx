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
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function HoldingReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  if (
    process.env.NODE_ENV === "development" &&
    returnsPreviews.includes(preview as ReturnsPreview)
  )
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
  const fx = await loadReturnExchangeRates(histories);
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
      issues={[...new Set([...issues, ...fx.warnings])]}
      portfolio={portfolio}
      names={names}
    />
  );
}
