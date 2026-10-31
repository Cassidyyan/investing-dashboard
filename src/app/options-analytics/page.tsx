import { Suspense } from "react";
import { loadOptionsAnalytics } from "@/server/load-options-analytics";
import { OptionsAnalyticsDashboard } from "@/components/options-analytics/OptionsAnalyticsDashboard";
import { OptionsLoading } from "@/components/options-analytics/OptionsLoading";
import { loadWealthsimpleDataset } from "@/server/wealthsimple-import";
import {
  createOptionsPreview,
  optionsPreviews,
  type OptionsPreview,
} from "@/dev/previews/options-analytics-preview";
export const dynamic = "force-dynamic";
export const revalidate = 0;
async function LiveOptions() {
  const dataset = await loadWealthsimpleDataset();
  const data = await loadOptionsAnalytics(undefined, dataset);
  return (
    <OptionsAnalyticsDashboard
      data={{ ...data, importPreview: dataset?.preview }}
    />
  );
}
export default async function OptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  if (
    process.env.NODE_ENV === "development" &&
    optionsPreviews.includes(preview as OptionsPreview)
  )
    return (
      <OptionsAnalyticsDashboard
        data={createOptionsPreview(preview as OptionsPreview)}
        preview={preview}
        isLoading={preview === "loading"}
      />
    );
  return (
    <Suspense fallback={<OptionsLoading />}>
      <LiveOptions />
    </Suspense>
  );
}
