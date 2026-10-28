import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AccountsDashboard } from "@/components/accounts/AccountsDashboard";
import { AccountsTable } from "@/components/accounts/AccountsTable";
import { AccountsLoading } from "@/components/accounts/AccountsLoading";
import { AllocationBar } from "@/components/accounts/AllocationBar";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { createAccountsPreview } from "@/dev/previews/accounts-preview";
import { money } from "@/lib/format";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/accounts",
}));
function accounts() {
  const { portfolio } = createAccountsPreview("sample");
  if (portfolio.accounts.status !== "ok") throw Error("fixture");
  return portfolio.accounts.data;
}
it("keeps four accessible columns and distinguishes reported totals from expanded holdings estimates", () => {
  const html = renderToStaticMarkup(<AccountsTable accounts={accounts()} />);
  expect(html.match(/scope="col"/g)).toHaveLength(4);
  expect(html).toContain('id="account-sample-tfsa"');
  expect(html).toContain(money({ amount: 57400, currency: "CAD" }));
  expect(html).toContain("Reported total");
  expect(html).toContain("Estimated from holdings");
  expect(html).toContain(money({ amount: 50400, currency: "CAD" }));
  expect(html).toContain("Estimates &amp; buying power");
  expect(html).toContain("•••• 1234");
});
it("places the combined estimate before the account list and keeps allocation based on reported totals", () => {
  const html = renderToStaticMarkup(
    <AccountsDashboard {...createAccountsPreview("sample")} preview="sample" />,
  );
  expect(html.indexOf("Combined CAD + USD value")).toBeLessThan(
    html.indexOf("Investing accounts</h2>"),
  );
  expect(html).toContain("Estimated from holdings + cash");
  expect(html).toContain("Exchange rate and conversion information");
  expect(html).toContain("not a live Wealthsimple quote");
});
it("masks reported totals, cash, buying power, estimates and allocation values including collapsed content", () => {
  const { portfolio, rate } = createAccountsPreview("sample");
  const html = renderToStaticMarkup(
    <BalancePrivacyProvider initialHidden>
      <AccountsDashboard portfolio={portfolio} rate={rate} />
    </BalancePrivacyProvider>,
  );
  for (const value of [
    "57,400",
    "68,000",
    "30,800",
    "50,400",
    "2,400",
    "800.00",
    "5,000",
  ])
    expect(html).not.toContain(value);
  expect(html).toContain("••••");
  expect(html).toContain("Sample TFSA");
});
it("shows unavailable estimates without replacing a failed conversion with zero", () => {
  const { portfolio } = createAccountsPreview("sample");
  const html = renderToStaticMarkup(
    <AccountsDashboard
      portfolio={portfolio}
      rate={{ status: "error", message: "Rate unavailable" }}
    />,
  );
  expect(html).toContain("Conversion unavailable");
  expect(html).toContain("Unavailable");
  expect(html).toContain(money({ amount: 57400, currency: "CAD" }));
});
it("provides skeletons without sample balances and supports empty, reconnect, and refreshing states", () => {
  const loading = renderToStaticMarkup(<AccountsLoading />);
  expect(loading.match(/aria-label="Loading /g)).toHaveLength(3);
  expect(loading).not.toContain("Sample TFSA");
  const empty = renderToStaticMarkup(
    <AccountsDashboard {...createAccountsPreview("empty")} />,
  );
  expect(empty).toContain("No investing accounts to show");
  expect(empty).toContain("/cash");
  const error = renderToStaticMarkup(
    <AccountsDashboard {...createAccountsPreview("error")} />,
  );
  expect(error).toContain('role="alert"');
  expect(error).toContain("Reconnect in SnapTrade");
  const refreshing = renderToStaticMarkup(
    <AccountsDashboard
      {...createAccountsPreview("sample")}
      preview="refreshing"
    />,
  );
  expect(refreshing).toContain("Refreshing…");
  expect(refreshing).toContain('aria-busy="true"');
  expect(refreshing).toContain("disabled");
});
it("excludes negative reported totals from allocation and exposes a text alternative", () => {
  const rows = accounts();
  rows[0].account.value.amount = -1;
  const html = renderToStaticMarkup(<AllocationBar accounts={rows} />);
  expect(html).not.toContain("Sample TFSA");
  expect(html).toContain("reported totals");
  expect(html).toContain("%");
  expect(html).toContain("Missing and negative totals excluded");
});
