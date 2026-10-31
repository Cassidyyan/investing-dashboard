export type TransactionSync = {
  initialSyncCompleted: boolean | null;
  firstTransactionDate: string | null;
  lastSuccessfulSync: string | null;
  invalidMetadata: boolean;
};
export type TransactionCoverage = {
  status: "complete" | "partial";
  records: number;
  rawRecords: number;
  expectedTotal: number | null;
  pages: number;
  earliest: string | null;
  latest: string | null;
  retrievedAt: string;
  cache: "fresh" | "cached";
  duplicates: number;
  errorCode: string | null;
  optionRecords: number;
  events: { assignment: number; exercise: number; expiration: number };
  fields: {
    field: string;
    applicable: number;
    missing: number;
    invalid: number;
  }[];
};
export type CoverageRow = {
  label: string;
  coverage: TransactionCoverage;
  sync?: TransactionSync;
};
