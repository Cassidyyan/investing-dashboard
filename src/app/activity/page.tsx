import { selectedPreview, previewsEnabled } from "@/server/config";
import {
  activityPreviews,
  createActivityPreview,
  type ActivityPreview,
} from "@/dev/previews/activity-preview";
import { Suspense } from "react";
import { loadPortfolio } from "@/server/load-portfolio";
import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { ActivityLoading } from "@/components/activity/ActivityLoading";
export const dynamic = "force-dynamic";
export const revalidate = 0;
async function LoadedActivity() {
  const portfolio = await loadPortfolio(undefined, ["orders", "activities"]);
  return <ActivityDashboard portfolio={portfolio} />;
}
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview: requested } = await searchParams;
  const preview = selectedPreview(requested);
  if (
    previewsEnabled() &&
    activityPreviews.includes(preview as ActivityPreview)
  )
    return (
      <ActivityDashboard
        portfolio={createActivityPreview(preview as ActivityPreview)}
        isLoading={preview === "loading"}
        preview={preview as ActivityPreview}
      />
    );
  return (
    <Suspense fallback={<ActivityLoading />}>
      <LoadedActivity />
    </Suspense>
  );
}
