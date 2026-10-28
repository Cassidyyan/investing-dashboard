import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HoldingReturnsDashboard } from "@/components/returns/HoldingReturnsDashboard";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import type { HoldingReturn } from "@/lib/returns/holding-returns";
const row = (
  symbol: string,
  profit: number,
  percent: number,
): HoldingReturn => ({
  key: `${symbol}:CAD`,
  symbol,
  currency: "CAD",
  accounts: ["Test"],
  firstPurchase: "2026-01-01",
  purchases: 1000,
  realized: profit,
  unrealized: 0,
  dividends: 0,
  charges: 0,
  totalProfit: profit,
  returnPercent: percent,
  sales: [{ date: "2026-02-01", units: 5, profit }],
  issues: [],
});
it("defaults to profit ranking rather than percentage and exposes sale details", () => {
  const html = renderToStaticMarkup(
    createElement(HoldingReturnsDashboard, {
      rows: [row("PERCENT_WINNER", 25, 100), row("PROFIT_WINNER", 300, 30)],
      issues: [],
    }),
  );
  expect(html).toContain("<h3>PROFIT_WINNER</h3>");
  expect(html).toContain("1 profitable / 1 sales");
  expect(html).toContain("First recorded buy:");
  expect(html).toContain("not a guarantee");
});
it("masks profits and return percentages when balances are hidden", () => {
  const html = renderToStaticMarkup(
    <BalancePrivacyProvider initialHidden>
      <HoldingReturnsDashboard
        rows={[row("TEST", 3141.59, 37.42)]}
        issues={[]}
      />
    </BalancePrivacyProvider>,
  );
  expect(html).toContain(".....");
  expect(html).toContain("TEST");
  expect(html).not.toContain("3,141.59");
  expect(html).not.toContain("37.42%");
});

it("opens a currency with eligible returns and makes coverage warnings visible", () => {
  const unavailable = {
    ...row("CAD_MISSING", 0, 0),
    totalProfit: null,
    returnPercent: null,
    issues: ["Missing purchase history."],
  };
  const usd = {
    ...row("USD_AVAILABLE", 50, 10),
    key: "USD_AVAILABLE:USD",
    currency: "USD",
  };
  const html = renderToStaticMarkup(
    createElement(HoldingReturnsDashboard, {
      rows: [unavailable, usd],
      issues: ["Unmatched transaction."],
    }),
  );
  expect(html).toContain("<h3>USD_AVAILABLE</h3>");
  expect(html).toContain('value="USD" selected=""');
  expect(html).toContain("matched records are shown below");
  expect(html).toContain("Unmatched transaction.");
});

it("clearly marks historical FX estimates and explains reconciled transfers", () => {
  const r = {
    ...row("TEST", 100, 10),
    notes: [
      "Historical FX estimate: Bank of Canada daily reference rates.",
      "Internal share transfer reconciled: original recorded purchase cost carried between accounts.",
    ],
  };
  const html = renderToStaticMarkup(
    createElement(HoldingReturnsDashboard, { rows: [r], issues: [] }),
  );
  expect(html).toContain("Historical FX estimate");
  expect(html).toContain("Bank of Canada daily reference rates");
  expect(html).toContain("Calculation notes");
  expect(html).toContain("original recorded purchase cost");
});
