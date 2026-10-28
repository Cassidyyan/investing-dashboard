import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { HoldingsDashboard } from "@/components/holdings/HoldingsDashboard";
import { HoldingsLoading } from "@/components/holdings/HoldingsLoading";
import { createHoldingsPreview } from "@/lib/holdings-preview";
import {
  HoldingsTable,
  sortHoldingEntries,
} from "@/components/holdings/HoldingsTable";
import { flattenHoldings } from "@/lib/holdings-view";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/holdings",
}));
it("provides flat positions, sortable value column, sibling navigation and one allocation card", () => {
  const html = renderToStaticMarkup(
    <HoldingsDashboard {...createHoldingsPreview("sample")} preview="sample" />,
  );
  expect(html).toContain("Portfolio sections");
  expect(html).toContain("Your positions");
  expect(html).toContain('aria-sort="descending"');
  expect(html).toContain("Group by account");
  expect(html).toContain("Search positions");
  expect(html).toContain("Combined est. USD");
  expect(html).toContain("positions excluded");
  expect(html).toContain("Show all (");
  expect(html).not.toContain("Industry allocation · all accounts");
  expect(html).not.toContain("Day change");
  expect(html).toContain('scope="col"');
  expect(html).toContain("Logo.dev");
});
it("hides monetary values while keeping weights and concentrations visible", () => {
  const html = renderToStaticMarkup(
    <HoldingsDashboard {...createHoldingsPreview("hidden")} preview="hidden" />,
  );
  expect(html).toContain("••••");
  expect(html).toContain("Chart hidden");
  expect(html).toContain("%");
  expect(html).not.toContain("CAD 57,400");
  expect(html).not.toContain("USD 1,680.00");
  expect(html).toContain("Sample TFSA");
});
it("provides real skeletons, empty positions, reconnect and refreshing states", () => {
  const loading = renderToStaticMarkup(<HoldingsLoading />);
  expect(loading).toContain("Loading allocation");
  expect(loading).toContain("Loading positions");
  expect(loading).not.toContain("invented");
  const empty = renderToStaticMarkup(
    <HoldingsDashboard {...createHoldingsPreview("empty")} />,
  );
  expect(empty).toContain("No holding positions");
  const error = renderToStaticMarkup(
    <HoldingsDashboard {...createHoldingsPreview("error")} />,
  );
  expect(error).toContain("Reconnect in SnapTrade");
  const refresh = renderToStaticMarkup(
    <HoldingsDashboard
      {...createHoldingsPreview("sample")}
      preview="refreshing"
    />,
  );
  expect(refresh).toContain("Refreshing…");
  expect(refresh).toContain("disabled");
});
it("restores account sections without changing positions or values", () => {
  const { portfolio, rate } = createHoldingsPreview("sample");
  if (portfolio.accounts.status !== "ok") throw Error("fixture");
  const accounts = portfolio.accounts.data,
    entries = flattenHoldings(accounts).filter((e) => e.position.units !== 0);
  const html = renderToStaticMarkup(
    <HoldingsTable
      entries={entries}
      group
      sort={{ key: "value", direction: "descending" }}
      onSort={() => {}}
      mode="COMBINED_USD"
      rate={rate}
      total={10000}
      accounts={accounts}
    />,
  );
  expect(html).toContain("Sample TFSA");
  expect(html).toContain("Sample RRSP");
  expect(html).toContain("Position details");
  expect(html).toContain("Average cost");
});
it("sorts missing weights after positive weights in both directions", () => {
  const { portfolio, rate } = createHoldingsPreview("sample");
  if (portfolio.accounts.status !== "ok") throw Error("fixture");
  const entries = flattenHoldings(portfolio.accounts.data);
  for (const direction of ["ascending", "descending"] as const) {
    const sorted = sortHoldingEntries(
      entries,
      { key: "weight", direction },
      "COMBINED_USD",
      rate,
    );
    const firstMissing = sorted.findIndex(
      (e) => e.position.value.amount === null || e.position.value.amount <= 0,
    );
    expect(firstMissing).toBeGreaterThan(0);
    expect(
      sorted
        .slice(firstMissing)
        .every(
          (e) =>
            e.position.value.amount === null || e.position.value.amount <= 0,
        ),
    ).toBe(true);
  }
});
