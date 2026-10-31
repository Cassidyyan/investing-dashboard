import { selectedPreview, previewsEnabled } from "@/server/config";
import { loadPortfolio } from "@/server/load-portfolio";
import { loadPerformance } from "@/server/load-performance";
import { calendarToday } from "@/lib/performance/performance";
import { Suspense } from "react";
import { PerformanceLoading } from "@/components/performance/PerformanceLoading";
import type { PerformancePreview } from "@/components/performance/PerformanceDashboard";
import { PerformanceDashboard } from "@/components/performance/PerformanceDashboard";
import { createPerformancePreview } from "@/dev/previews/performance-preview";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview: requested } = await searchParams;
  const preview = selectedPreview(requested);
  const previews = [
    "sample",
    "empty",
    "error",
    "loading",
    "refreshing",
    "hidden",
    "single",
    "mixed",
    "reported",
  ];
  if (previewsEnabled() && previews.includes(preview || "")) {
    const sample = createPerformancePreview(preview as PerformancePreview);
    return (
      <PerformanceDashboard
        accounts={sample.history}
        today={sample.today}
        portfolio={sample.portfolio}
        preview={preview as PerformancePreview}
      />
    );
  }
  return (
    <Suspense fallback={<PerformanceLoading />}>
      <LivePerformance />
    </Suspense>
  );
}
async function LivePerformance() {
  const portfolio = await loadPortfolio(undefined, ["positions"]);
  const history =
    portfolio.accounts.status === "ok"
      ? await loadPerformance(portfolio.accounts.data)
      : [];
  return (
    <PerformanceDashboard
      accounts={history}
      today={calendarToday()}
      portfolio={portfolio}
    />
  );
}
