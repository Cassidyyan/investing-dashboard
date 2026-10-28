import { loadPortfolio } from "@/server/load-portfolio";
import { loadHoldingTransactions } from "@/server/load-holding-returns";
import { calculateHoldingReturns } from "@/lib/returns/holding-returns";
import { PortfolioPage } from "@/components/layout/PortfolioPage";
import { HoldingReturnsDashboard } from "@/components/returns/HoldingReturnsDashboard";
import { loadReturnExchangeRates } from "@/server/return-exchange-rates";
import { getSecurityLogoUrl } from "@/server/security-logo";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function HoldingReturnsPage() {
  const portfolio = await loadPortfolio(undefined, ["positions"], "history");
  const accounts =
    portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const histories = await loadHoldingTransactions(accounts);
  const fx = await loadReturnExchangeRates(histories);
  const rows = calculateHoldingReturns(accounts, fx.histories).map((row) => ({
    ...row,
    // Lifetime results also include sold securities whose current kind is absent.
    logoUrl: getSecurityLogoUrl(row.symbol, "other"),
  }));
  const issues = histories.flatMap((h) =>
    [...h.issues, ...(h.warnings || [])].map(
      (issue) =>
        `${accounts.find((a) => a.account.id === h.accountId)?.account.name || "Account"}: ${issue}`,
    ),
  );
  return (
    <PortfolioPage portfolio={portfolio} path="/returns">
      {() => (
        <HoldingReturnsDashboard
          rows={rows}
          issues={[...new Set([...issues, ...fx.warnings])]}
        />
      )}
    </PortfolioPage>
  );
}
