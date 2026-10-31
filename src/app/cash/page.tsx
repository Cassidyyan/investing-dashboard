import { selectedPreview, previewsEnabled } from "@/server/config";
import { Suspense } from "react";
import { loadPortfolio } from "@/server/load-portfolio";
import { CashDashboard } from "@/components/cash/CashDashboard";
import { CashLoading } from "@/components/cash/CashLoading";
import {
  cashPreviews,
  createCashPreview,
  type CashPreviewState,
} from "@/dev/previews/cash-preview";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview: requested } = await searchParams;
  const preview = selectedPreview(requested);
  if (previewsEnabled() && cashPreviews.includes(preview as CashPreviewState))
    return (
      <CashDashboard
        portfolio={createCashPreview(preview as CashPreviewState)}
        preview={preview as CashPreviewState}
      />
    );
  return (
    <Suspense fallback={<CashLoading />}>
      <LiveCash />
    </Suspense>
  );
}
async function LiveCash() {
  // Same existing request, section selection, and cash-account scope. No FX fetch.
  const portfolio = await loadPortfolio(undefined, ["balances"], "cash");
  return <CashDashboard portfolio={portfolio} />;
}
