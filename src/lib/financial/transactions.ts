import type {
  DataIssue,
  DecimalField,
  EntryDelta,
  FinancialDate,
  MoneyField,
} from "./types";
import type { OptionAction, OptionContract } from "@/lib/options/types";
export type SourceScalar = string | number | null;
export type NormalizedTransaction = {
  importEvidence?: {
    source: "wealthsimple-csv";
    row: number;
    actionMethod: "explicit" | "source-side" | "unavailable";
    transferDirection?: "in" | "out";
  };
  id: string | null;
  accountId: string;
  securityId: string | null;
  securityType?: string | null;
  sourceMetadata?: {
    rawSecuritySymbol: string | null;
    optionContractId: string | null;
    rawUnderlyingSymbol: string | null;
    isMiniOption: boolean | null;
  };
  ticker: string | null;
  securityCurrency: string | null;
  type: string;
  direction: "buy" | "sell" | "unknown";
  optionAction: OptionAction;
  option: OptionContract | null;
  optionRelated: boolean;
  tradeDate: FinancialDate;
  settlementDate: FinancialDate;
  quantity: DecimalField;
  price: MoneyField;
  cashFlow: MoneyField;
  fee: MoneyField;
  grossAmount: MoneyField;
  netAmount: MoneyField;
  cashConvention: "unspecified" | "reported-net";
  fxRate: DecimalField;
  externalReferenceId: string | null;
  description: string;
  entryDelta: EntryDelta;
  issues: DataIssue[];
  sourceValues: {
    currency?: string | null;
    units: SourceScalar;
    price: SourceScalar;
    amount: SourceScalar;
    fee: SourceScalar;
    fxRate: SourceScalar;
  };
};
