import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { ActivityLoading } from "@/components/activity/ActivityLoading";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import { createAccountsPreview } from "@/dev/previews/accounts-preview";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/activity",
}));
it("renders one date-grouped activity feed using loaded transactions, limited to 15", () => {
  const { portfolio } = createAccountsPreview("sample");
  if (portfolio.accounts.status !== "ok") throw Error("fixture");
  portfolio.accounts.data[0].activities = {
    status: "ok",
    data: {
      total: 20,
      rows: Array.from({ length: 20 }, (_, i) => ({
        description: `Fixture trade ${i}`,
        type: "BUY",
        date: portfolio.retrievedAt,
        amount: { amount: -1234.56, currency: "CAD" },
      })),
    },
  };
  const html = renderToStaticMarkup(
    <ActivityDashboard portfolio={portfolio} />,
  );
  expect(html.match(/<li>/g)).toHaveLength(15);
  expect(html).toContain("Show more (5)");
  expect(html).toContain("Today");
  expect(html).toContain("Transactions");
  expect(html).toContain("Orders");
  expect(html).not.toContain("records");
});
it("masks feed money without losing date/account identities", () => {
  const { portfolio } = createAccountsPreview("sample");
  if (portfolio.accounts.status !== "ok") throw Error("fixture");
  portfolio.accounts.data[0].activities = {
    status: "ok",
    data: {
      total: 1,
      rows: [
        {
          description: "Fixture dividend",
          type: "DIVIDEND",
          date: portfolio.retrievedAt,
          amount: { amount: 1234.56, currency: "CAD" },
        },
      ],
    },
  };
  const html = renderToStaticMarkup(
    <BalancePrivacyProvider initialHidden>
      <ActivityDashboard portfolio={portfolio} />
    </BalancePrivacyProvider>,
  );
  expect(html).not.toContain("1,234.56");
  expect(html).toContain("Show balances");
  expect(html).toContain("Fixture dividend");
});
it("provides loading, empty, error and reconnect states without substitute transactions", () => {
  expect(renderToStaticMarkup(<ActivityLoading />)).toContain(
    "Loading activity",
  );
  const { portfolio } = createAccountsPreview("empty");
  expect(
    renderToStaticMarkup(<ActivityDashboard portfolio={portfolio} />),
  ).toContain("No transactions to show");
  const error = createAccountsPreview("error").portfolio;
  const html = renderToStaticMarkup(<ActivityDashboard portfolio={error} />);
  expect(html).toContain('role="alert"');
  expect(html).toContain("Reconnect in SnapTrade");
});

it("keeps date-only activity on the reported calendar day without inventing a time", () => {
  const { portfolio } = createAccountsPreview("sample");
  if (portfolio.accounts.status !== "ok") throw Error("fixture");
  portfolio.retrievedAt = "2026-10-28T18:00:00Z";
  portfolio.accounts.data[0].activities = {
    status: "ok",
    data: {
      total: 1,
      rows: [
        {
          description: "Fixture date-only trade",
          type: "BUY",
          date: "2026-10-28",
          amount: { amount: 1, currency: "CAD" },
        },
      ],
    },
  };
  const html = renderToStaticMarkup(
    <ActivityDashboard portfolio={portfolio} />,
  );
  expect(html).toContain("Today transactions");
  expect(html).toContain("Oct 28, 2026");
  expect(html).not.toContain("8:00 p.m.");
});
