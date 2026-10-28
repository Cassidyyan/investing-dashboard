import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PerformanceDashboard } from "@/components/performance/PerformanceDashboard";
import { PerformanceLoading } from "@/components/performance/PerformanceLoading";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { createPerformancePreview } from "@/dev/previews/performance-preview";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/performance",
}));
function render(state = "sample") {
  const sample = createPerformancePreview(state);
  return renderToStaticMarkup(
    <PerformanceDashboard
      accounts={sample.history}
      today={sample.today}
      portfolio={sample.portfolio}
    />,
  );
}
it("reuses the shared page system, exposes source dates and hides unsupported five-year controls", () => {
  const html = render();
  expect(html).toContain("Your portfolio over time");
  expect(html).toContain("Performance sections");
  expect(html).toContain("Data through Oct 11, 2026");
  expect(html).toContain("Change in value");
  expect(html).toContain("since Oct 1, 2026");
  expect(html).not.toContain('type="range"');
  expect(html).not.toContain(">5Y<");
  expect(html).not.toContain("History availability &amp; setup");
  expect(html).toContain('stroke="var(--ov-brand)"');
  expect(html).toContain('data-gap="true"');
  expect(html).toContain("History view");
  expect(html).toContain("Account performance");
});
it("retains both funding estimates and excludes future funding", () => {
  const html = render();
  expect(html).toContain("Gain vs net deposits");
  expect(html).toContain("Range return · cash-flow adjusted");
  expect(html).toContain("+10.00%");
  expect(html).toContain("+13.33%");
  expect(html).not.toContain("90,000");
  expect(html).toContain("Modified Dietz");
});
it("retains the chart and an explanation when funding is incomplete", () => {
  const sample = createPerformancePreview();
  sample.history[0].funding = {
    status: "error",
    message: "Funding history incomplete",
  };
  const html = renderToStaticMarkup(
    <PerformanceDashboard
      accounts={sample.history}
      today={sample.today}
      portfolio={sample.portfolio}
    />,
  );
  expect(html).toContain("Funding history incomplete");
  expect(html).toContain("daily account value. Use left and right arrows");
  expect(html).not.toContain("+13.33%");
});
it("masks monetary figures and blurs charts while percentages remain visible", () => {
  const sample = createPerformancePreview();
  const html = renderToStaticMarkup(
    <BalancePrivacyProvider initialHidden>
      <PerformanceDashboard
        accounts={sample.history}
        today={sample.today}
        portfolio={sample.portfolio}
      />
    </BalancePrivacyProvider>,
  );
  expect(html).toContain("+10.00%");
  expect(html).toContain("+13.33%");
  expect(html).not.toContain("2,200");
  expect(html).not.toContain("2,000");
  expect(html).toContain("••••");
});
it("provides single-point, empty, reconnect and real loading states", () => {
  expect(render("single")).toContain("One daily snapshot is available");
  expect(render("empty")).toContain("No observed values");
  expect(render("error")).toContain("Reconnect in SnapTrade");
  const html = renderToStaticMarkup(<PerformanceLoading />);
  expect(html).toContain("Loading account value");
  expect(html).toContain("Loading brokerage returns");
  expect(html).not.toContain("invented");
});
it("shows native currency controls only when both currencies are present", () => {
  expect(render()).not.toContain('aria-label="History currency"');
  expect(render("mixed")).toContain('aria-label="History currency"');
});
it("uses one reported-return empty state or a compact table with only supplied periods", () => {
  const empty = render();
  expect(empty).toContain("How to enable");
  const table = render("reported");
  expect(table).toContain("Reported by your brokerage");
  expect(table).toContain("+4.20%");
  expect(table).toContain('scope="col">1M');
  expect(table).not.toContain('scope="col">YTD');
});
it("keeps missing brokerage periods explicit while rendering a genuine zero return", () => {
  const sample = createPerformancePreview("reported");
  sample.history[0].returns = {
    status: "ok",
    data: [{ timeframe: "1D", percent: 0, asOf: "2026-10-11" }],
  };
  sample.history.push({
    ...sample.history[0],
    id: "second",
    name: "Second account",
    returns: {
      status: "ok",
      data: [{ timeframe: "1M", percent: -2, asOf: "2026-10-11" }],
    },
  });
  const html = renderToStaticMarkup(
    <PerformanceDashboard
      accounts={sample.history}
      today={sample.today}
      portfolio={sample.portfolio}
    />,
  );
  expect(html).toContain("0.00%");
  expect(html).toContain("-2.00%");
  expect(html).toContain("Why 1M is missing for Sample TFSA");
  expect(html).toContain("Why 1D is missing for Second account");
  expect(html).toContain("Reported 1D date for Sample TFSA");
});
it("keeps existing values while refreshing and disables the shared refresh action", () => {
  const sample = createPerformancePreview();
  const html = renderToStaticMarkup(
    <PerformanceDashboard
      accounts={sample.history}
      today={sample.today}
      portfolio={sample.portfolio}
      preview="refreshing"
    />,
  );
  expect(html).toContain("Refreshing…");
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("disabled");
  expect(html).toContain("2,200.00");
});
