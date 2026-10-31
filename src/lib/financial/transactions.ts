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
  id: string | null;
  accountId: string;
  securityId: string | null;
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
  cashConvention: "unspecified";
  fxRate: DecimalField;
  externalReferenceId: string | null;
  description: string;
  entryDelta: EntryDelta;
  issues: DataIssue[];
  sourceValues: {
    units: SourceScalar;
    price: SourceScalar;
    amount: SourceScalar;
    fee: SourceScalar;
    fxRate: SourceScalar;
  };
};
