import { Suspense } from "react";
import { loadExchangeRate } from "@/server/exchange-rate";
import { loadPortfolio } from "@/server/load-portfolio";
import { getSecurityLogoUrl } from "@/server/security-logo";
import { flattenHoldings } from "@/lib/holdings-view";
import {
  createHoldingsPreview,
  holdingsPreviews,
  type HoldingsPreviewState,
} from "@/lib/holdings-preview";
import { HoldingsDashboard } from "@/components/holdings/HoldingsDashboard";
import { HoldingsLoading } from "@/components/holdings/HoldingsLoading";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function HoldingsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  if (
    process.env.NODE_ENV === "development" &&
    holdingsPreviews.includes(preview as HoldingsPreviewState)
  )
    return (
      <HoldingsDashboard
        {...createHoldingsPreview(preview as HoldingsPreviewState)}
        preview={preview as HoldingsPreviewState}
      />
    );
  return (
    <Suspense fallback={<HoldingsLoading />}>
      <LiveHoldings />
    </Suspense>
  );
}
async function LiveHoldings() {
  // Same existing sections and rate request. No extra brokerage or quote calls.
  const [portfolio, rate] = await Promise.all([
    loadPortfolio(undefined, ["positions"]),
    loadExchangeRate(),
  ]);
  const accounts =
    portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const logos = Object.fromEntries(
    flattenHoldings(accounts).map((e) => [
      `${e.position.symbol}|${e.position.kind}`,
      getSecurityLogoUrl(e.position.symbol, e.position.kind),
    ]),
  );
  return <HoldingsDashboard portfolio={portfolio} rate={rate} logos={logos} />;
}
