// Shared display data shapes. Result<T> carries either usable data or a safe error message.
export type Result<T> =
  { status: "ok"; data: T } | { status: "error"; message: string };
export type ExchangeRate = { cadPerUsd: number; asOf: string };
export type Money = { amount: number | null; currency: string | null };
export type AccountView = {
  category?: string | null;
  id: string;
  name: string;
  institution: string;
  suffix: string;
  type: string;
  value: Money;
  syncedAt: string | null;
  incomplete: boolean;
  stale: boolean;
};
export type BalanceView = { cash: Money; buyingPower: Money };
export type OptionDetails = {
  type: "CALL" | "PUT" | null;
  strike: Money;
  expiration: string | null;
  multiplier: number | null;
  underlyingId: string | null;
  underlyingSymbol: string | null;
  underlyingKind: string | null;
};
export type PositionView = {
  instrumentId?: string;
  optionDetails?: OptionDetails | null;
  cashEquivalent?: boolean;
  symbol: string;
  description: string;
  kind: string;
  units: number | null;
  price: Money;
  averageCost?: Money;
  unrealizedReturn?: Money;
  unrealizedReturnPercent?: number | null;
  value: Money;
};
export type OrderView = {
  symbol: string;
  action: string;
  status: string;
  quantity: number | null;
  placedAt: string | null;
};
export type ActivityView = {
  description: string;
  type: string;
  date: string | null;
  amount: Money;
};
export type ConnectionView = {
  name: string;
  status: "Connected" | "Disabled" | "Unknown";
};
export type AccountData = {
  cashOnly?: boolean;
  account: AccountView;
  balances: Result<BalanceView[]>;
  positions: Result<{ rows: PositionView[]; asOf: string | null }>;
  orders: Result<OrderView[]>;
  activities: Result<{ rows: ActivityView[]; total: number | null }>;
};
export type Portfolio = {
  configured: boolean;
  retrievedAt: string;
  accounts: Result<AccountData[]>;
  connections: Result<ConnectionView[]>;
};

export type HistoryPoint = { date: string; value: number };
export type AccountHistory = {
  currency: string;
  points: HistoryPoint[];
  omittedPoints: number;
};
export type ReportedReturn = {
  timeframe: string;
  percent: number;
  asOf: string | null;
};
export type FundingEvent = {
  date: string | null;
  amount: number | null;
  currency: string | null;
  issue?: string;
};
export type AccountFunding = { events: FundingEvent[] };
export type PerformanceAccount = {
  id: string;
  name: string;
  suffix: string;
  history: Result<AccountHistory>;
  returns: Result<ReportedReturn[]>;
  funding?: Result<AccountFunding>;
};
