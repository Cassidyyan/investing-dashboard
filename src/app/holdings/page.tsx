import { loadExchangeRate } from "@/server/exchange-rate";
import { IndustryPieChart } from "@/components/IndustryPieChart";
import { loadPortfolio } from "@/server/load-portfolio";
import { PortfolioPage } from "@/components/PortfolioPage";
import { HoldingsPieChart } from "@/components/HoldingsPieChart";
import { PositionsTabs } from "@/components/PositionsTabs";
import { OptionsDetails } from "@/components/OptionsDetails";
import { PositionsTable } from "@/components/PositionsTable";
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
          <details className="panel collapsible-panel">
            <summary>Industry allocation · all accounts</summary>
            <IndustryPieChart accounts={accounts} rate={rate} />
          </details>
          <details className="panel collapsible-panel">
            <summary>Holdings allocation charts</summary>
            <HoldingsPieChart accounts={accounts} />
          </details>
          <PositionsTabs
            holdings={
              <PositionsTable accounts={accounts} category="holdings" />
            }
            optionPositions={<OptionsDetails accounts={accounts} />}
          />
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
