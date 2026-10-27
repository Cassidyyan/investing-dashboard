import { loadExchangeRate } from "@/server/exchange-rate";
import { IndustryPieChart } from "@/components/charts/IndustryPieChart";
import { loadPortfolio } from "@/server/load-portfolio";
import { PortfolioPage } from "@/components/layout/PortfolioPage";
import { HoldingsPieChart } from "@/components/charts/HoldingsPieChart";
import { PositionsTabs } from "@/components/holdings/PositionsTabs";
import { OptionsDetails } from "@/components/options/OptionsDetails";
import { PositionsTable } from "@/components/holdings/PositionsTable";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function HoldingsPage() {
  const [portfolio, rate] = await Promise.all([
    loadPortfolio(undefined, ["positions"]),
    loadExchangeRate(),
  ]);
  return (
    <PortfolioPage portfolio={portfolio} path="/holdings">
      {(accounts) => (
        <>
          <PositionsTabs
            holdings={
              <PositionsTable accounts={accounts} category="holdings" />
            }
            optionPositions={<OptionsDetails accounts={accounts} />}
          />
          <details className="panel collapsible-panel">
            <summary>Industry allocation · all accounts</summary>
            <IndustryPieChart accounts={accounts} rate={rate} />
          </details>
          <details className="panel collapsible-panel">
            <summary>Holdings allocation charts</summary>
            <HoldingsPieChart accounts={accounts} />
          </details>
          <p className="muted">
            Logos by{" "}
            <a href="https://www.logo.dev" target="_blank" rel="noreferrer">
              Logo.dev
            </a>
          </p>
        </>
      )}
    </PortfolioPage>
  );
}
