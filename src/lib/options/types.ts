import type { Decimal } from "@/lib/financial/decimal";
import type {
  DataIssue,
  DecimalField,
  EntryDelta,
  FinancialField,
  MoneyField,
  Provenance,
} from "@/lib/financial/types";
export type OptionAction =
  "BUY_TO_OPEN" | "BUY_TO_CLOSE" | "SELL_TO_OPEN" | "SELL_TO_CLOSE" | "unknown";
export type OptionContract = {
  id: string | null;
  symbol: string | null;
  occRoot: string | null;
  underlyingId: string | null;
  underlyingTicker: string | null;
  type: FinancialField<"CALL" | "PUT">;
  strike: MoneyField;
  expiration: FinancialField<string>;
  multiplier: DecimalField;
  source: "position" | "activity" | "order";
  issues: DataIssue[];
};
export type OptionExecution = {
  sourceOrder?: { clock: string; key: string };
  id: string;
  accountId: string;
  transactionId: string;
  contract: OptionContract;
  action: Exclude<OptionAction, "unknown">;
  quantity: Decimal;
  cashFlow: MoneyField;
  fee: MoneyField;
  tradeDate: string;
  instant: string | null;
  entryDelta: EntryDelta;
  externalReferenceId: string | null;
};
// Matching links quantities only; cash accounting and strategy inference are separate Phase 2 concerns.
export type OptionMatch = {
  openingId: string;
  closingId: string;
  accountId: string;
  contractKey: string;
  direction: "long" | "short";
  quantity: Decimal;
};
export type LifecycleStatus = "open" | "closed" | "needs-reconciliation";
export type OptionLifecycle = {
  id: string;
  accountId: string;
  contract: OptionContract;
  direction: "long" | "short";
  openingTransactions: string[];
  closingTransactions: string[];
  openedOn: string;
  closedOn: string | null;
  remainingQuantity: Decimal;
  status: LifecycleStatus;
  entryDelta: EntryDelta;
  // Never populated by matching alone: premium receipts are not realized P&L.
  premiumReceived: MoneyField | null;
  premiumPaid: MoneyField | null;
  fees: MoneyField | null;
  realizedPnl: MoneyField | null;
  entryDte: number | null;
  holdingDays: number | null;
  strategy: "unknown";
  outcome: "unclassified";
  completeness: {
    status: "complete" | "partial" | "unresolved";
    issues: DataIssue[];
  };
  provenance: Provenance[];
};
export type StrategyAssociation = {
  id: string;
  accountId: string;
  lifecycleIds: string[];
  type: "covered-call" | "cash-secured-put" | "wheel" | "multi-leg" | "unknown";
  provenance: "manual" | "verified-provider";
};
// Future persistence seam only. No implementation, filesystem writes or database is introduced.
export interface OptionHistoryRepository {
  readLifecycles(accountId: string): Promise<readonly OptionLifecycle[]>;
  saveVerifiedLifecycle(lifecycle: OptionLifecycle): Promise<void>;
}
