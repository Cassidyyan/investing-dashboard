import { loadPortfolio } from "@/server/load-portfolio";
import { loadExchangeRate } from "@/server/exchange-rate";
import { adaptOverview } from "@/lib/overview/overview";
import {
  createOverviewPreview,
  overviewPreviews,
  type OverviewPreview,
} from "@/dev/previews/overview-preview";
import { OverviewDashboard } from "@/components/overview/OverviewDashboard";
import { OverviewLoading } from "@/components/overview/OverviewLoading";
import { Suspense } from "react";
import { getSecurityLogoUrl } from "@/server/security-logo";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  if (
    process.env.NODE_ENV === "development" &&
    overviewPreviews.includes(preview as OverviewPreview)
  ) {
    return (
      <OverviewDashboard
        model={createOverviewPreview(preview as OverviewPreview)}
        preview={preview as OverviewPreview}
      />
    );
  }
  return (
    <Suspense fallback={<OverviewLoading />}>
      <LiveOverview />
    </Suspense>
  );
}
async function LiveOverview() {
  // The live overview keeps its original data requests and account scope.
  const [portfolio, exchangeRate] = await Promise.all([
    loadPortfolio(undefined, ["balances"], "overview"),
    loadExchangeRate(),
  ]);
  const model = adaptOverview(portfolio, exchangeRate);
  model.holdings = model.holdings.map((holding) => ({
    ...holding,
    logoUrl: getSecurityLogoUrl(holding.symbol, holding.kind || "unknown"),
  }));
  return <OverviewDashboard model={model} />;
}
