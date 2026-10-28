import type {
  AccountFunding,
  FundingEvent,
  HistoryPoint,
  PerformanceAccount,
  Result,
} from "@/lib/types";

export function aggregateFunding(
  accounts: PerformanceAccount[],
  currency: string,
): Result<AccountFunding> {
  const included = accounts.filter(
    (a) => a.history.status === "ok" && a.history.data.currency === currency,
  );
  const events: FundingEvent[] = [];
  for (const account of included) {
    if (!account.funding || account.funding.status === "error")
      return {
        status: "error",
        message:
          account.funding?.status === "error"
            ? account.funding.message
            : "Funding history is unavailable for an included account.",
      };
    events.push(...account.funding.data.events);
  }
  return included.length
    ? { status: "ok", data: { events } }
    : {
        status: "error",
        message: "No accounts with history in this currency.",
      };
}

const metric = (percent: number | null, reason: string | null = null) => ({
  percent: percent !== null && Number.isFinite(percent) ? percent : null,
  reason:
    percent !== null && !Number.isFinite(percent)
      ? "Return exceeds the supported numeric range."
      : reason,
});
function fundingIssue(events: FundingEvent[], currency: string) {
  for (const event of events) {
    if (event.issue) return event.issue;
    if (!event.date || event.amount === null || !Number.isFinite(event.amount))
      return "Funding date or amount is unavailable.";
    if (event.currency !== currency)
      return "Funding uses a different currency; historical funding FX reconciliation is required.";
  }
  return null;
}

// Both metrics use only events through the inspected daily snapshot. Net-deposit
// gain is not TWR. Period return is Modified Dietz, assuming end-of-day flows.
export function cashFlowReturns(
  start: HistoryPoint,
  end: HistoryPoint,
  currency: string,
  funding: Result<AccountFunding>,
) {
  if (funding.status === "error")
    return {
      netDeposits: null,
      netGain: metric(null, funding.message),
      period: metric(null, funding.message),
    };
  const through = funding.data.events.filter(
    (e) => !e.date || e.date <= end.date,
  );
  const inPeriod = through.filter((e) => !e.date || e.date > start.date);
  const netIssue = fundingIssue(through, currency),
    periodIssue = fundingIssue(inPeriod, currency);
  const net = netIssue ? null : through.reduce((sum, e) => sum + e.amount!, 0);
  const netDeposits = net !== null && Number.isFinite(net) ? net : null;
  const netGain = netIssue
    ? metric(null, netIssue)
    : netDeposits === null || netDeposits <= 0
      ? metric(
          null,
          "Positive net deposits are required; opening funding may be missing.",
        )
      : metric(((end.value - netDeposits) / netDeposits) * 100);
  const duration = Date.parse(end.date) - Date.parse(start.date);
  if (periodIssue)
    return { netDeposits, netGain, period: metric(null, periodIssue) };
  if (!(duration > 0))
    return {
      netDeposits,
      netGain,
      period: metric(null, "Inspect a date after the first visible snapshot."),
    };
  const flows = inPeriod.reduce((sum, e) => sum + e.amount!, 0);
  const weighted = inPeriod.reduce(
    (sum, e) =>
      sum +
      e.amount! * ((Date.parse(end.date) - Date.parse(e.date!)) / duration),
    0,
  );
  const denominator = start.value + weighted;
  const period =
    denominator > 0 && Number.isFinite(denominator)
      ? metric(((end.value - start.value - flows) / denominator) * 100)
      : metric(
          null,
          "Positive time-weighted capital is required for this period.",
        );
  return { netDeposits, netGain, period };
}
