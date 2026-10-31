import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { OverviewDashboard } from "@/components/overview/OverviewDashboard";
import { createOverviewPreview } from "@/dev/previews/overview-preview";
import { ChangeBadge } from "@/components/shared/ChangeBadge";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/",
}));
it("renders the new cards with real navigation destinations and a single status area", () => {
  const html = renderToStaticMarkup(
    <OverviewDashboard
      model={createOverviewPreview("sample")}
      preview="sample"
    />,
  );
  for (const title of [
    "Portfolio value",
    "Cash balances",
    "Your accounts",
    "Asset allocation",
    "Top holdings",
    "Recent activity",
  ])
    expect(html).toContain(title);
  expect(html).toContain("Development preview");
  expect(html).toContain("invented sample data");
  expect(html).not.toContain("Brokerage accounts");
  expect(html).not.toContain("Explore your workspace");
  expect(html).toContain("/accounts#account-sample-tfsa");
  expect(html).toContain('aria-label="Display currency"');
});
it("hides monetary values and retains allocation percentages in hidden mode", () => {
  const html = renderToStaticMarkup(
    <OverviewDashboard
      model={createOverviewPreview("hidden")}
      preview="hidden"
    />,
  );
  expect(html).toContain("••••");
  expect(html).toContain("Chart hidden");
  for (const value of [
    "150,000",
    "92,000",
    "58,000",
    "2,500",
    "1,200",
    "35,000",
    "12,500",
    "24.50",
    "250.00",
  ])
    expect(html).not.toContain(value);
  expect(html).toContain("60.0%");
});
it("renders a skeleton for every card and a disabled spinning refresh state", () => {
  const loading = renderToStaticMarkup(
    <OverviewDashboard
      model={createOverviewPreview("loading")}
      preview="loading"
    />,
  );
  expect(loading.match(/data-skeleton="card"/g)).toHaveLength(6);
  const refreshing = renderToStaticMarkup(
    <OverviewDashboard
      model={createOverviewPreview("refreshing")}
      preview="refreshing"
    />,
  );
  expect(refreshing).toContain("Refreshing…");
  expect(refreshing).toContain('aria-busy="true"');
  expect(refreshing).toContain("disabled");
});
it("provides meaningful empty and reconnect states", () => {
  const empty = renderToStaticMarkup(
    <OverviewDashboard
      model={createOverviewPreview("empty")}
      preview="empty"
    />,
  );
  expect(empty).toContain("No investing accounts");
  expect(empty).toContain("No recent activity");
  const error = renderToStaticMarkup(
    <OverviewDashboard
      model={createOverviewPreview("error")}
      preview="error"
    />,
  );
  expect(error).toContain('role="alert"');
  expect(error).toContain("Reconnect in SnapTrade");
});
it("uses signs and arrows for gains and losses", () => {
  const positive = renderToStaticMarkup(
    <ChangeBadge change={{ amount: 20, percent: 2 }} currency="CAD" />,
  );
  const negative = renderToStaticMarkup(
    <ChangeBadge change={{ amount: -20, percent: -2 }} currency="CAD" />,
  );
  expect(positive).toContain("↑");
  expect(positive).toContain("+CAD");
  expect(positive).toContain("+2.00%");
  expect(negative).toContain("↓");
  expect(negative).toContain("-CAD");
  expect(negative).toContain("-2.00%");
});

it("shows real loading skeletons without sample financial data or a mock banner", async () => {
  const { OverviewLoading } =
    await import("@/components/overview/OverviewLoading");
  const html = renderToStaticMarkup(<OverviewLoading />);
  expect(html.match(/data-skeleton="card"/g)).toHaveLength(6);
  expect(html).toContain("Loading portfolio…");
  expect(html).not.toContain("Development preview");
  expect(html).not.toContain("Sample TFSA");
});
it("uses connected native history and transaction states instead of not-connected placeholders", () => {
  const model = createOverviewPreview("history");
  const html = renderToStaticMarkup(
    <OverviewDashboard model={model} preview="history" />,
  );
  expect(html).toContain("CAD account value history");
  expect(html).toContain("Latest daily value change");
  expect(html).toContain("Gain vs recorded net deposits");
  expect(html).toContain("+10.00%");
  expect(html).toContain("History coverage");
  expect(html).not.toContain("History not connected");
  expect(html).not.toContain("Returns &amp; history unavailable");
});
