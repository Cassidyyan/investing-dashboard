import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createOptionsPreview } from "@/dev/previews/options-analytics-preview";
import { OptionsAnalyticsDashboard } from "@/components/options-analytics/OptionsAnalyticsDashboard";
import { OptionsCharts } from "@/components/options-analytics/OptionsCharts";
import { OptionsLoading } from "@/components/options-analytics/OptionsLoading";
import { optionsAnalytics } from "@/lib/options/analytics";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/options-analytics",
}));
it("renders the real route loading fallback before an updated timestamp exists", () => {
  const html = renderToStaticMarkup(<OptionsLoading />);
  expect(html).toContain("Loading options analytics");
  expect(html).toContain("Loading portfolio");
  expect(html).not.toContain("Updated ");
});
it("spaces chart observations by elapsed calendar time rather than equal transaction intervals", () => {
  const stats = optionsAnalytics(createOptionsPreview("sample"), {
    account: "all",
    ticker: "all",
    currency: "USD",
    from: "",
    to: "",
    right: "all",
    status: "all",
  });
  const html = renderToStaticMarkup(
    <OptionsCharts stats={stats} currency="USD" />,
  );
  const points = /<polyline points="([^"]+)"/
    .exec(html)![1]
    .split(" ")
    .map((p) => Number(p.split(",")[0]));
  // August 10 → September 2 is 23 days; September 2 → 12 is 10 days.
  expect((points[1] - points[0]) / (points[2] - points[1])).toBeCloseTo(2.3);
});
it("renders the options MVP with source limitations and no invented Greeks", () => {
  const html = renderToStaticMarkup(
    <OptionsAnalyticsDashboard
      data={createOptionsPreview("sample")}
      preview="sample"
    />,
  );
  for (const label of [
    "Net realized P&amp;L",
    "Gross premiums collected",
    "Options trade journal",
    "Performance by underlying",
    "Data coverage",
    "Needs review",
    "Sample data",
  ])
    expect(html).toContain(label);
  expect(html.replaceAll("\u00a0", " ")).toContain("USD 470.00");
  expect(html).toContain("75.0%");
  expect(html).toContain("Opening premium credits");
  expect(html).not.toContain("delta: 0.");
});
it("removes monetary text and financial chart geometry when balances are hidden", () => {
  const html = renderToStaticMarkup(
    <OptionsAnalyticsDashboard
      data={createOptionsPreview("hidden")}
      preview="hidden"
    />,
  );
  expect(html).toContain("Chart hidden");
  expect(html).toContain("Amount hidden");
  expect(html.replaceAll("\u00a0", " ")).not.toContain("USD 470.00");
  expect(html).not.toContain("<polyline");
  expect(html).toContain("75.0%");
});
it.each(["empty", "error", "loading"] as const)(
  "renders synthetic %s without treating missing P&L as zero",
  (state) => {
    const html = renderToStaticMarkup(
      <OptionsAnalyticsDashboard
        data={createOptionsPreview(state)}
        preview={state}
        isLoading={state === "loading"}
      />,
    );
    expect(html).toContain(
      state === "empty"
        ? "No historical options activity"
        : state === "error"
          ? "Retry options history"
          : "Loading options analytics",
    );
    expect(html).not.toContain("USD 470.00");
  },
);
