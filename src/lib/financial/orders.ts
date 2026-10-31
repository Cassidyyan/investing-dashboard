import type {
  DecimalField,
  FinancialDate,
  FinancialField,
  MoneyField,
} from "./types";
import type { OptionContract } from "@/lib/options/types";

// Cumulative broker order state, never an individual execution or cash-flow record.
export type NormalizedOrder = {
  accountId: string;
  id: string | null;
  groupId: string | null;
  role: string | null;
  status: string | null;
  action: string | null;
  symbol: string | null;
  quantity: DecimalField;
  filledQuantity: DecimalField;
  openQuantity: DecimalField;
  canceledQuantity: DecimalField;
  executionPrice: MoneyField;
  placedAt: FinancialDate;
  executedAt: FinancialDate;
  updatedAt: FinancialDate;
  option: OptionContract | null;
  recordKind: "order-snapshot";
  executionIdentity: FinancialField<string>;
};
