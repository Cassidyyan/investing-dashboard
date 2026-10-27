import { loadPortfolio } from "@/server/load-portfolio";
import { PortfolioPage } from "@/components/PortfolioPage";
import { OrdersList } from "@/components/OrdersList";
import { ActivityList } from "@/components/ActivityList";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function ActivityPage() {
  const portfolio = await loadPortfolio(undefined, ["orders", "activities"]);
  return (
    <PortfolioPage portfolio={portfolio} path="/activity">
      {(accounts) => (
        <div className="two-col">
          <section className="panel">
            <h2>Recent orders</h2>
            <p className="muted">Expand an account to see its recent orders.</p>
            <OrdersList accounts={accounts} />
          </section>
          <section className="panel">
            <h2>Account activity</h2>
            <p className="muted">
              Expand an account to see its recent transactions.
            </p>
            <ActivityList accounts={accounts} />
          </section>
        </div>
      )}
    </PortfolioPage>
  );
}
