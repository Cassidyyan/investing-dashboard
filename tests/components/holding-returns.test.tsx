import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { HoldingReturnsDashboard } from "@/components/returns/HoldingReturnsDashboard";
import { ReturnsLoading } from "@/components/returns/ReturnsLoading";
import { LeaderboardTable } from "@/components/returns/LeaderboardTable";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { createReturnsPreview } from "@/dev/previews/returns-preview";
import { isRanked, sortReturns } from "@/lib/returns/presentation";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/returns",
}));
function render(state: Parameters<typeof createReturnsPreview>[0] = "sample") {
  return renderToStaticMarkup(
    <HoldingReturnsDashboard {...createReturnsPreview(state)} />,
  );
}
it("uses shared navigation and neutral best/worst cards with one coverage strip and a details dialog", () => {
  const html = render();
  expect(html).toContain("What has earned the most?");
  expect(html).toContain("Performance sections");
  expect(html).toContain("12 of 15 holdings ranked · Estimates");
  expect(html).toContain("Best holding");
  expect(html).toContain("Worst holding");
  expect(html).toContain("<h3>ALPHA</h3>");
  expect(html).toContain("Largest gain among ranked holdings");
  expect(html).toContain("<dialog");
  expect(html).toContain("Partial-history account notes");
  expect(html).toContain("cannot be attributed");
  expect(html).not.toContain("returns-winner");
  expect(html).not.toContain("eligible records");
});
it("keeps profitable sale details, existing FX notes and account-filter scope explicit", () => {
  const html = render();
  expect(html).toContain("Sales history");
  expect(html).toContain("First recorded buy date");
  expect(html).toContain("FX est.");
  expect(html).toContain("Bank of Canada daily reference rates");
  expect(html).toContain("original recorded purchase cost");
  expect(html).toContain("per-account profit breakdowns are not supplied");
  expect(html).toContain("Calculation notes");
  expect(html).toContain("Logo.dev");
});
it("hides monetary amounts while leaving percentages visible", () => {
  const html = renderToStaticMarkup(
    <BalancePrivacyProvider initialHidden>
      <HoldingReturnsDashboard {...createReturnsPreview()} />
    </BalancePrivacyProvider>,
  );
  expect(html).toContain("••••");
  expect(html).not.toContain("3,600.00");
  expect(html).not.toContain("1,200.00");
  expect(html).toContain("+12.00%");
  expect(html).toContain("ALPHA");
});
it("limits the leaderboard to ten after sorting the entire set", () => {
  const sample = createReturnsPreview();
  const ranked = sample.rows.filter((r) => r.currency === "CAD" && isRanked(r));
  const sorted = sortReturns(ranked, "profit-asc");
  const html = renderToStaticMarkup(
    <LeaderboardTable
      rows={sorted}
      currency="CAD"
      names={sample.names}
      max={1200}
    />,
  );
  expect(html.match(/<tbody/g)).toHaveLength(10);
  expect(html).toContain("Show all 12");
  expect(html).toContain("<strong>MU</strong>");
  expect(html).not.toContain("<strong>ALPHA</strong>");
  expect(html).not.toContain("CAD ");
  expect(html).toContain('scope="col"');
});
it("provides needs-data filters and all-unranked, empty, loading and reconnect states", () => {
  const unranked = render("unranked");
  expect(unranked).toContain("0 of 3 holdings ranked");
  expect(unranked).toContain("3 holdings can’t be ranked yet");
  expect(unranked).toContain("No purchase basis");
  expect(unranked).toContain("Short sale");
  expect(unranked).toContain("Trades don’t reconcile");
  expect(unranked).toContain("Next step:");
  expect(unranked).toContain("earlier purchase or transfer-in cost");
  expect(unranked).not.toContain('aria-label="Best holding"');
  expect(render("empty")).toContain("No supported holding transactions");
  expect(render("error")).toContain("Reconnect in SnapTrade");
  const loading = renderToStaticMarkup(<ReturnsLoading />);
  expect(loading).toContain("Loading leaderboard");
  expect(loading).toContain("Loading data coverage");
  expect(loading).not.toContain("invented sample");
});
it("keeps figures visible and disables refresh during refresh", () => {
  const html = renderToStaticMarkup(
    <HoldingReturnsDashboard
      {...createReturnsPreview()}
      preview="refreshing"
    />,
  );
  expect(html).toContain("Refreshing…");
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("3,600.00");
});
