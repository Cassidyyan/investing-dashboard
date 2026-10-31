import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  BalancePrivacyProvider,
  BalanceVisibilityToggle,
  PrivateValue,
} from "@/components/shared/BalancePrivacy";
import { HoldingsTable } from "@/components/holdings/HoldingsTable";
import { createHoldingsPreview } from "@/dev/previews/holdings-preview";
import type { PositionView } from "@/lib/types";
it("replaces hidden amounts rather than retaining them in accessible text or titles", () => {
  const html = renderToStaticMarkup(
    <BalancePrivacyProvider initialHidden>
      <PrivateValue>CAD 12,345.67</PrivateValue>
    </BalancePrivacyProvider>,
  );
  expect(html).toContain("••••••");
  expect(html).toContain('aria-label="Amount hidden"');
  expect(html).not.toContain("12,345.67");
});
it("shows formatted values when balances are visible", () => {
  const html = renderToStaticMarkup(
    <BalancePrivacyProvider initialHidden={false}>
      <PrivateValue>CAD 12,345.67</PrivateValue>
    </BalancePrivacyProvider>,
  );
  expect(html).toContain("CAD 12,345.67");
  expect(html).not.toContain("••••••");
});
it("labels the toggle with its action and pressed state", () => {
  const html = renderToStaticMarkup(
    <BalancePrivacyProvider initialHidden>
      <BalanceVisibilityToggle />
    </BalancePrivacyProvider>,
  );
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("Show balances");
});
it("masks holdings quantities, costs, prices, values, and returns while retaining the ticker", () => {
  const { portfolio, rate } = createHoldingsPreview("sample");
  if (portfolio.accounts.status !== "ok") throw Error("fixture");
  const accounts = portfolio.accounts.data;
  const position: PositionView = {
    symbol: "TEST",
    kind: "stock",
    description: "Test company",
    units: 12.34567,
    price: { amount: 789.43, currency: "CAD" },
    averageCost: { amount: 456.21, currency: "CAD" },
    value: { amount: 9746.05, currency: "CAD" },
    unrealizedReturn: { amount: 4113.08, currency: "CAD" },
    unrealizedReturnPercent: 73.04,
  };
  const html = renderToStaticMarkup(
    <BalancePrivacyProvider initialHidden>
      <HoldingsTable
        accounts={accounts}
        entries={[{ key: "test", account: accounts[0].account, position }]}
        group={false}
        mode="CAD"
        rate={rate}
        total={9746.05}
        sort={{ key: "value", direction: "descending" }}
        onSort={() => {}}
      />
    </BalancePrivacyProvider>,
  );
  for (const value of ["12.34567", "789.43", "456.21", "9,746.05", "4,113.08"])
    expect(html).not.toContain(value);
  expect(html).toContain("TEST");
  expect(html).toContain("••••");
  expect(html).toContain("73.04");
});
