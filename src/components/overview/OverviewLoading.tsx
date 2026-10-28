import type { OverviewModel } from "@/lib/overview/overview";
import { OverviewDashboard } from "./OverviewDashboard";
// Real Suspense fallback: no financial sample data or pretend account state.
export function OverviewLoading() {
  const model: OverviewModel = {
    configured: true,
    error: null,
    expired: false,
    updatedAt: new Date().toISOString(),
    rate: null,
    partial: false,
    accounts: [],
    cash: { CAD: null, USD: null, partial: false },
    assets: [],
    holdings: [],
    dayChange: null,
    totalReturn: null,
    history: null,
    activity: null,
    mock: false,
  };
  return <OverviewDashboard model={model} isLoading />;
}
