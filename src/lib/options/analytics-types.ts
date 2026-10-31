import type { Decimal } from "@/lib/financial/decimal";
import type { NormalizedTransaction } from "@/lib/financial/transactions";
import type { OptionContract, OptionExecution } from "./types";
import type {
  TransactionCoverage,
  TransactionSync,
} from "@/lib/financial/history-coverage";

export type OptionsHistory = {
  accountId: string;
  records: NormalizedTransaction[];
  issues: string[];
  coverage?: TransactionCoverage;
};
export type ExecutionCash = {
  premium: Decimal | null; // Signed gross premium, not net cash or profit.
  net: Decimal | null;
  fee: Decimal | null;
  currency: string | null;
  convention: "zero-fee" | "gross" | "net" | "unresolved";
  issues: string[];
};
export type JournalExecution = OptionExecution & {
  csvActionMethod?: "explicit" | "source-side" | "unavailable";
  price: Decimal | null;
  kind: "trade" | "expiration";
  cash: ExecutionCash;
};
export type OptionRealization = {
  date: string;
  pnl: Decimal;
  fees: Decimal;
  quantity: Decimal;
  openingId: string;
  closingId: string;
};
export type AnalyticsTrade = {
  id: string;
  accountId: string;
  ticker: string;
  contract: OptionContract | null;
  direction: "long" | "short" | "unknown";
  openedOn: string | null;
  observedOn: string | null;
  closedOn: string | null;
  openedQuantity: Decimal | null;
  closedQuantity: Decimal | null;
  remainingQuantity: Decimal | null;
  status: "open" | "partial" | "closed" | "needs-review";
  currency: string | null;
  entryPremium: Decimal | null;
  exitPremium: Decimal | null;
  fees: Decimal | null;
  premiumReceived: Decimal | null;
  premiumPaid: Decimal | null;
  realizedPnl: Decimal | null;
  entryDte: number | null;
  outcome: "win" | "loss" | "breakeven" | "unclassified";
  executions: JournalExecution[];
  events: {
    type: string;
    date: string | null;
    quantity: Decimal | null;
    amount: Decimal | null;
    fee: Decimal | null;
    currency: string | null;
  }[];
  realizations: OptionRealization[];
  issues: string[];
};
export type OptionsLedger = {
  trades: AnalyticsTrade[];
  issues: { accountId: string; reason: string }[];
};
export type OpenOption = {
  accountId: string;
  ticker: string;
  symbol: string;
  right: "CALL" | "PUT" | null;
  quantity: number | null;
  currency: string | null;
  value: number | null;
};
export type OptionsData = OptionsLedger & {
  historySource?: "csv" | "snaptrade";
  snapshotError?: string | null;
  importReconciliation?: import("@/lib/imports/wealthsimple-activity").ImportReconciliation;
  importPreview?:
    import("@/lib/imports/wealthsimple-activity").ActivityImportPreview | null;
  historyCoverage?: {
    accountId: string;
    coverage: TransactionCoverage;
    sync?: TransactionSync;
  }[];
  accounts: { id: string; name: string; suffix: string }[];
  openPositions: OpenOption[];
  updatedAt: string;
  configured: boolean;
  error: string | null;
  reconnect: boolean;
};
export type OptionsFilters = {
  account: string;
  ticker: string;
  currency: string;
  from: string;
  to: string;
  right: "all" | "CALL" | "PUT";
  status: "all" | AnalyticsTrade["status"];
};
