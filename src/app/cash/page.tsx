import { loadPortfolio } from "@/server/load-portfolio";
import { PortfolioPage } from "@/components/layout/PortfolioPage";
import { CashAccountsTable } from "@/components/cash/CashAccountsTable";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function CashPage() {
  const portfolio = await loadPortfolio(undefined, ["balances"], "cash");
  return (
    <PortfolioPage portfolio={portfolio} path="/cash">
      {(accounts) => (
        <section className="panel">
          <h2>
            Cash &amp; chequing{" "}
            <span className="badge">{accounts.length} shown</span>
          </h2>
          <p className="muted">
            Banking accounts identified by the brokerage, plus accounts
            confirmed to have no open holdings. Cash-only investing accounts
            appear here too; they are not automatically classified as chequing
            or savings. These accounts are excluded from investing totals.
            Zero-CAD and zero-USD accounts remain hidden.
          </p>
          <CashAccountsTable accounts={accounts} />
        </section>
      )}
    </PortfolioPage>
  );
}
