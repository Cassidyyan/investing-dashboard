import { loadPortfolio } from "@/server/load-portfolio";
import { loadPerformance } from "@/server/load-performance";
import { calendarToday } from "@/lib/performance";
import { PortfolioPage } from "@/components/layout/PortfolioPage";
import { PerformanceDashboard } from "@/components/performance/PerformanceDashboard";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function PerformancePage() {
  const portfolio = await loadPortfolio(undefined, ["positions"]);
  const history =
    portfolio.accounts.status === "ok"
      ? await loadPerformance(portfolio.accounts.data)
      : [];
  return (
    <PortfolioPage portfolio={portfolio} path="/performance">
      {() => (
        <PerformanceDashboard accounts={history} today={calendarToday()} />
      )}
    </PortfolioPage>
  );
}
