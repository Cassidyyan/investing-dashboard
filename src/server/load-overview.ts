import "server-only";
import { getSnaptrade, type ReadClient } from "./snaptrade";
import { loadPortfolio } from "./load-portfolio";
import { loadPerformance } from "./load-performance";
import { loadExchangeRate } from "./exchange-rate";
import { adaptOverview } from "@/lib/overview/overview";
import { connectOverviewHistory } from "@/lib/overview/history";
import { calendarToday } from "@/lib/performance/performance";
import { getSecurityLogoUrl } from "./security-logo";

export async function loadOverview(
  client: ReadClient | null = getSnaptrade(),
  today = calendarToday(),
) {
  const [portfolio, rate] = await Promise.all([
    loadPortfolio(client, ["balances", "activities"], "overview"),
    loadExchangeRate(),
  ]);
  const investing =
    portfolio.accounts.status === "ok"
      ? portfolio.accounts.data.filter((a) => !a.cashOnly)
      : [];
  // Reuse history/funding once; Overview does not need the deprecated returns API.
  const performance = investing.length
    ? await loadPerformance(investing, client, {
        reportedReturns: false,
      })
    : [];
  const model = connectOverviewHistory(
    adaptOverview(portfolio, rate, { activitiesLoaded: true }),
    performance,
    today,
  );
  model.holdings = model.holdings.map((h) => ({
    ...h,
    logoUrl: getSecurityLogoUrl(h.symbol, h.kind || "unknown"),
  }));
  return model;
}
