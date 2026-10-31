import { selectedPreview, previewsEnabled } from "@/server/config";
import { loadOverview } from "@/server/load-overview";
import {
  createOverviewPreview,
  overviewPreviews,
  type OverviewPreview,
} from "@/dev/previews/overview-preview";
import { OverviewDashboard } from "@/components/overview/OverviewDashboard";
import { OverviewLoading } from "@/components/overview/OverviewLoading";
import { Suspense } from "react";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview: requested } = await searchParams;
  const preview = selectedPreview(requested);
  if (
    previewsEnabled() &&
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
  const model = await loadOverview();
  return <OverviewDashboard model={model} />;
}
