import { loadExchangeRate } from "@/server/exchange-rate";
import { CurrencyTotal } from "@/components/accounts/CurrencyTotal";
import { loadPortfolio } from "@/server/load-portfolio";
import { PortfolioPage } from "@/components/layout/PortfolioPage";
import { AccountsTable } from "@/components/accounts/AccountsTable";
import { AllocationBar } from "@/components/accounts/AllocationBar";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function AccountsPage() {
  const [portfolio, rate] = await Promise.all([
    loadPortfolio(undefined, ["balances", "positions"]),
    loadExchangeRate(),
  ]);
  return (
    <PortfolioPage portfolio={portfolio} path="/accounts">
      {(accounts) => (
        <>
          <section className="panel">
            <h2>
              Your accounts{" "}
              <span className="badge">{accounts.length} shown</span>
            </h2>
            <p className="muted">
              Accounts with a reported total of 0 CAD or 0 USD, and accounts
              confirmed to have no open holdings, are hidden. CAD and USD
              columns estimate cash plus holdings in each original currency;
              brokerage totals are shown separately.
            </p>
            <AccountsTable accounts={accounts} />
          </section>
          <details className="panel collapsible-panel">
            <summary>Account allocation</summary>
            <AllocationBar accounts={accounts} />
          </details>
          <CurrencyTotal accounts={accounts} rate={rate} />
        </>
      )}
    </PortfolioPage>
  );
}
