import type { AccountData } from "@/lib/types";
import type { TransactionHistory } from "./holding-returns";
import { calendarDay } from "@/lib/financial/validation";

// A retired, empty position does not need a live market quote. Require completed
// transaction evidence and a holdings sync after every activity being evaluated.
// The API response retrieval time alone does not prove brokerage freshness.
export function verifiedClosedSnapshot(
  account: AccountData,
  history: TransactionHistory | undefined,
  symbol: string,
): boolean {
  if (
    account.account.incomplete ||
    account.positions.status !== "ok" ||
    history?.coverage?.status !== "complete" ||
    history.issues.length ||
    account.account.transactionSync?.initialSyncCompleted !== true ||
    account.account.transactionSync.invalidMetadata
  )
    return false;
  const synced = calendarDay(account.account.syncedAt);
  const rows = history.transactions.filter((t) => t.symbol === symbol);
  return (
    !!synced &&
    rows.length > 0 &&
    rows.every((t) => !!t.date && t.date < synced) &&
    !account.positions.data.rows.some(
      (p) => p.symbol === symbol && p.units !== 0,
    )
  );
}
