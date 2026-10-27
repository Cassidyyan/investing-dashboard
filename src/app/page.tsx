// Overview stays short; the other pages contain detailed tables and records.
import { NavigationLink } from "@/components/NavigationProgress";
import { loadPortfolio } from "@/server/load-portfolio";
import { PortfolioPage } from "@/components/PortfolioPage";
import { SummaryCards } from "@/components/SummaryCards";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function Page() {
  const portfolio = await loadPortfolio(undefined, ["balances"], "overview");
  return (
    <PortfolioPage portfolio={portfolio} path="/">
      {(accounts) => (
        <>
          <SummaryCards
            accounts={accounts.filter((a) => !a.cashOnly)}
            cashAccounts={accounts}
          />
          <div className="overview-links">
            {[
              {
                href: "/accounts",
                label: "Your accounts",
                description: "Balances, buying power, and account allocation.",
                icon: "▦",
              },
              {
                href: "/holdings",
                label: "Holdings & options",
                description: "Allocation charts and current positions.",
                icon: "◈",
              },
              {
                href: "/activity",
                label: "Orders & activity",
                description: "Recent orders and account transactions.",
                icon: "≋",
              },
            ].map((item) => (
              <NavigationLink
                className="panel overview-link"
                key={item.href}
                href={item.href}
                prefetch={false}
              >
                <span className="metric-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <h2>
                  {item.label} <span aria-hidden="true">↗</span>
                </h2>
                <p className="muted">{item.description}</p>
              </NavigationLink>
            ))}
          </div>
        </>
      )}
    </PortfolioPage>
  );
}
