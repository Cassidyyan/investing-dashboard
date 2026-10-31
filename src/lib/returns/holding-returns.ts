import type { NormalizedTransaction } from "@/lib/financial/transactions";
import type { TransactionCoverage } from "@/lib/financial/history-coverage";
// Lifetime estimates from reported cash flows, with average-cost sale matching.
// This is an analytical return on total purchases, not TWR, IRR, or tax reporting.
import type { AccountData } from "@/lib/types";
import { reconcileTransfers } from "@/lib/returns/reconcile-transfers";
import { verifiedClosedSnapshot } from "./closed-snapshot";

export type SecurityTransaction = {
  sourceRecord?: NormalizedTransaction;
  reportedNet?: boolean;
  transferDirection?: "in" | "out";
  id: string;
  symbol: string;
  currency: string;
  date: string | null;
  order: string;
  type: string;
  units: number | null;
  amount: number | null;
  price: number | null;
  fee: number | null;
  issue?: string;
  basisTransfer?: boolean;
  originalPurchaseDate?: string;
  note?: string;
  securityCurrency?: string;
  fxConvertible?: boolean;
  fxAsOf?: string;
};
export type TransactionHistory = {
  sourceRecords?: NormalizedTransaction[];
  coverage?: TransactionCoverage;
  accountId: string;
  transactions: SecurityTransaction[];
  issues: string[];
  warnings?: string[];
};
export type SaleReturn = { date: string; units: number; profit: number };
export type HoldingReturn = {
  importedActivities?: number;
  logoUrl?: string | null;
  key: string;
  symbol: string;
  currency: string;
  accounts: string[];
  firstPurchase: string | null;
  purchases: number;
  realized: number | null;
  unrealized: number | null;
  dividends: number;
  charges: number;
  totalProfit: number | null;
  returnPercent: number | null;
  sales: SaleReturn[];
  issues: string[];
  notes?: string[];
  sourceGaps?: {
    account: string;
    earliest: string | null;
    latest: string | null;
    firstEvent: string | null;
    issues: string[];
  }[];
};
const positionKinds = new Set(["stock", "adr", "etf", "cef", "mutualfund"]);
export function supportsReturnPosition(p: { kind: string; symbol: string }) {
  return (
    positionKinds.has(p.kind) || (p.kind === "other" && p.symbol === "PHYS.TO")
  );
}
const close = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(0.00001, Math.abs(b) * 0.000001);

export function calculateHoldingReturns(
  accounts: AccountData[],
  histories: TransactionHistory[],
): HoldingReturn[] {
  histories = reconcileTransfers(accounts, histories);
  const combined = new Map<string, HoldingReturn>();
  for (const account of accounts) {
    const history = histories.find((h) => h.accountId === account.account.id);
    const positions =
      account.positions.status === "ok"
        ? account.positions.data.rows.filter(supportsReturnPosition)
        : [];
    const symbols = new Set([
      ...positions.map((p) => p.symbol),
      ...(history?.transactions.map((t) => t.symbol) || []),
    ]);
    for (const symbol of symbols) {
      const trades =
        history?.transactions.filter((t) => t.symbol === symbol) || [];
      const held = positions.filter((p) => p.symbol === symbol);
      const currencies = new Set([
        ...trades.map((t) => t.currency),
        ...held.map((p) => p.value.currency || "Unknown"),
      ]);
      for (const currency of currencies) {
        const issues = new Set(
          history?.issues || ["Transaction history unavailable."],
        );
        if (currencies.size > 1)
          issues.add(
            "Multiple transaction currencies require historical FX reconciliation.",
          );
        if (
          account.positions.status === "error" ||
          account.account.incomplete ||
          (account.account.stale &&
            !verifiedClosedSnapshot(account, history, symbol))
        )
          issues.add("Current holdings are incomplete, stale, or unavailable.");
        if (currency === "Unknown")
          issues.add("Transaction currency unavailable.");
        const rows = trades
          .filter((t) => t.currency === currency)
          .sort((a, b) => a.order.localeCompare(b.order));
        // Exact timestamps can establish order. Same-day-only buys and sells cannot.
        const dayTypes = new Map<string, Set<string>>();
        for (const t of rows) {
          if (!t.date || !["BUY", "SELL"].includes(t.type)) continue;
          const set = dayTypes.get(t.date) || new Set<string>();
          set.add(t.type);
          dayTypes.set(t.date, set);
          if (
            set.size > 1 &&
            rows.some(
              (r) =>
                r.date === t.date &&
                ["BUY", "SELL"].includes(r.type) &&
                (r.order.length === 10 ||
                  /T00:00:00(?:\.000)?(?:Z|\+00:00)$/.test(r.order)),
            )
          )
            issues.add("Same-day trade order is uncertain.");
        }
        let units = 0,
          basis = 0,
          purchases = 0,
          realized = 0,
          dividends = 0,
          charges = 0;
        let firstPurchase: string | null = null;
        const sales: SaleReturn[] = [];
        for (const t of rows) {
          if (t.issue) issues.add(t.issue);
          if (!t.date) {
            issues.add("Transaction date unavailable.");
            continue;
          }
          if (t.amount === null) {
            issues.add("Transaction amount unavailable.");
            continue;
          }
          if (["DIVIDEND", "SUBSTITUTE_DIVIDEND"].includes(t.type)) {
            dividends += t.amount;
            continue;
          }
          if (["FEE", "TAX"].includes(t.type)) {
            if (t.amount > 0)
              issues.add("Charge or refund requires reconciliation.");
            charges -= t.amount;
            continue;
          }
          if (!["BUY", "SELL"].includes(t.type)) {
            issues.add(
              t.type === "TRANSFER"
                ? "The share transfer needs its original purchase cost or a matching account record."
                : `Unsupported ${t.type || "unknown"} event requires reconciliation.`,
            );
            continue;
          }
          if (t.units === null || t.units <= 0) {
            issues.add("Trade quantity is missing, negative, or unsupported.");
            continue;
          }
          // Use reported signed cash amounts. Nonzero embedded fees are uncertain:
          // never subtract the fee twice or silently assume a gross/net convention.
          if (t.fee !== null && t.fee !== 0 && !t.reportedNet)
            issues.add("Trade fees require cash-amount reconciliation.");
          if (t.type === "BUY") {
            if (t.amount >= 0) {
              issues.add("Buy cash-flow sign is unsupported.");
              continue;
            }
            const cost = -t.amount;
            if (!t.basisTransfer) purchases += cost;
            basis += cost;
            units += t.units;
            if (firstPurchase === null)
              firstPurchase = t.originalPurchaseDate || t.date;
          } else {
            if (
              t.amount < 0 ||
              (t.units > units && !close(t.units, units)) ||
              units <= 0
            ) {
              issues.add(
                "A sale has no matching purchase history or is a short sale.",
              );
              continue;
            }
            const sold = Math.min(t.units, units),
              cost = (basis * sold) / units;
            const profit = t.amount - cost;
            realized += profit;
            basis -= cost;
            units -= sold;
            if (close(units, 0)) {
              units = 0;
              basis = 0;
            }
            if (!t.basisTransfer)
              sales.push({ date: t.date, units: t.units, profit });
          }
        }
        const current = held.filter((p) => p.value.currency === currency);
        if (
          current.some(
            (p) =>
              p.units === null || p.value.amount === null || (p.units ?? 0) < 0,
          )
        )
          issues.add(
            "Current quantity or valuation is unavailable, or a short position is present.",
          );
        const currentUnits = current.reduce(
          (sum, p) => sum + (p.units ?? 0),
          0,
        );
        if (!close(currentUnits, units))
          issues.add(
            "Recorded trades do not reconcile with current shares; purchases, transfers, or splits may be missing.",
          );
        if (!purchases && !rows.some((t) => t.basisTransfer))
          issues.add("No complete purchase basis is available.");
        const marketValue = current.reduce(
          (sum, p) => sum + (p.value.amount ?? 0),
          0,
        );
        const unrealized = marketValue - basis;
        const totalProfit = realized + unrealized + dividends - charges;
        if (
          ![
            purchases,
            realized,
            unrealized,
            dividends,
            charges,
            totalProfit,
          ].every(Number.isFinite)
        )
          issues.add("Calculated amounts exceed supported numeric limits.");
        const key = `${symbol}:${currency}`;
        const previous = combined.get(key);
        const result: HoldingReturn = previous || {
          key,
          symbol,
          currency,
          accounts: [],
          firstPurchase: null,
          purchases: 0,
          realized: 0,
          unrealized: 0,
          dividends: 0,
          charges: 0,
          totalProfit: 0,
          returnPercent: null,
          sales: [],
          issues: [],
        };
        result.accounts.push(account.account.name);
        result.importedActivities =
          (result.importedActivities || 0) +
          rows.filter((t) => t.sourceRecord?.importEvidence).length;
        result.firstPurchase =
          result.firstPurchase && firstPurchase
            ? result.firstPurchase < firstPurchase
              ? result.firstPurchase
              : firstPurchase
            : result.firstPurchase || firstPurchase;
        result.purchases += purchases;
        result.dividends += dividends;
        result.charges += charges;
        result.sales.push(...sales);
        result.issues = [...new Set([...result.issues, ...issues])];
        if (issues.size) {
          const dated = rows
            .filter((t) => t.date)
            .sort((a, b) => a.order.localeCompare(b.order));
          result.sourceGaps = [
            ...(result.sourceGaps || []),
            {
              account: account.account.name,
              earliest: dated[0]?.date || null,
              latest: dated.at(-1)?.date || null,
              firstEvent:
                dated[0]?.sourceRecord?.type || dated[0]?.type || null,
              issues: [...issues],
            },
          ];
        }
        result.notes = [
          ...new Set([
            ...(result.notes || []),
            ...rows.flatMap((t) => (t.note ? [t.note] : [])),
            ...(account.account.stale &&
            verifiedClosedSnapshot(account, history, symbol)
              ? [
                  "Closed holding: completed transaction history reconciles to zero shares in an older brokerage snapshot. No stale market quote is used.",
                ]
              : []),
          ]),
        ];
        result.realized =
          result.realized === null || issues.size
            ? null
            : result.realized + realized;
        result.unrealized =
          result.unrealized === null || issues.size
            ? null
            : result.unrealized + unrealized;
        result.totalProfit =
          result.totalProfit === null || issues.size
            ? null
            : result.totalProfit + totalProfit;
        result.returnPercent =
          result.totalProfit !== null && result.purchases > 0
            ? (result.totalProfit / result.purchases) * 100
            : null;
        if (
          ![result.purchases, result.dividends, result.charges].every(
            Number.isFinite,
          ) ||
          (result.totalProfit !== null &&
            !Number.isFinite(result.totalProfit)) ||
          (result.returnPercent !== null &&
            !Number.isFinite(result.returnPercent))
        ) {
          result.totalProfit = null;
          result.realized = null;
          result.unrealized = null;
          result.returnPercent = null;
          result.issues.push(
            "Aggregated amounts exceed supported numeric limits.",
          );
        }
        combined.set(key, result);
      }
    }
  }
  return [...combined.values()];
}
