// Phase 1 quantity matching only. No premium sums, realized P&L, or strategy inference.
import { calendarDay } from "@/lib/financial/validation";
import type { NormalizedTransaction } from "@/lib/financial/transactions";
import {
  absoluteDecimal,
  compareDecimal,
  decimal,
  subtractDecimal,
  type Decimal,
} from "@/lib/financial/decimal";
import type { DataIssue } from "@/lib/financial/types";
import type { OptionExecution, OptionMatch } from "./types";
import { optionContractKey } from "./contracts";
const zero = decimal("0")!;
export type OptionMatchingIssue = DataIssue & {
  accountId: string;
  transactionId: string | null;
};
export function reconcileOptionExecutions(
  records: readonly NormalizedTransaction[],
  asOfDay: string,
) {
  if (calendarDay(asOfDay) !== asOfDay)
    throw new RangeError("A valid as-of calendar day is required.");
  const issues: OptionMatchingIssue[] = [],
    executions: OptionExecution[] = [],
    events: NormalizedTransaction[] = [],
    seen = new Map<string, string>(),
    conflictingAccounts = new Set<string>();
  const issue = (t: NormalizedTransaction, code: string) =>
    issues.push({
      code,
      field: "option-execution",
      severity: "blocking",
      accountId: t.accountId,
      transactionId: t.id,
    });
  for (const t of records) {
    if (!t.optionRelated) continue;
    if (!t.id || !t.accountId) {
      issue(t, "missing_execution_identity");
      continue;
    }
    const id = JSON.stringify([t.accountId, t.id]);
    const fingerprint = JSON.stringify([
      t.type,
      t.optionAction,
      t.option,
      t.tradeDate,
      t.settlementDate,
      t.quantity.value,
      t.cashFlow.amount.value,
      t.cashFlow.currency.value,
      t.fee.amount.value,
      t.price,
      t.fxRate,
      t.securityId,
      t.externalReferenceId,
    ]);
    if (seen.has(id)) {
      if (seen.get(id) !== fingerprint) {
        issue(t, "conflicting_transaction_id");
        conflictingAccounts.add(t.accountId);
      } else
        issues.push({
          accountId: t.accountId,
          transactionId: t.id,
          code: "identical_duplicate_ignored",
          field: "id",
          severity: "warning",
        });
      continue;
    }
    seen.set(id, fingerprint);
    if (t.issues.some((i) => i.severity === "blocking")) {
      issue(t, "invalid_source_execution");
      continue;
    }
    if (t.type.startsWith("OPTION")) {
      events.push(t);
      issue(t, "lifecycle_event_requires_settlement_reconciliation");
      continue;
    }
    if (!t.option || !optionContractKey(t.option)) {
      issue(t, "incomplete_option_contract");
      continue;
    }
    if (t.optionAction === "unknown") {
      issue(t, "ambiguous_open_close_action");
      continue;
    }
    if (!t.tradeDate.day || t.tradeDate.precision === "invalid") {
      issue(t, "missing_trade_date");
      continue;
    }
    if (t.tradeDate.day > asOfDay) {
      issue(t, "execution_after_as_of");
      continue;
    }
    if (
      !t.quantity.value ||
      compareDecimal(absoluteDecimal(t.quantity.value), zero) === 0
    ) {
      issue(t, "missing_or_zero_contract_quantity");
      continue;
    }
    executions.push({
      id,
      accountId: t.accountId,
      transactionId: t.id,
      contract: t.option,
      action: t.optionAction,
      quantity: absoluteDecimal(t.quantity.value),
      cashFlow: t.cashFlow,
      fee: t.fee,
      tradeDate: t.tradeDate.day,
      instant: t.tradeDate.instant,
      entryDelta: t.entryDelta,
      externalReferenceId: t.externalReferenceId,
    });
  }
  const groups = new Map<string, OptionExecution[]>();
  for (const e of executions) {
    if (conflictingAccounts.has(e.accountId)) continue;
    const direction =
      e.action === "BUY_TO_OPEN" || e.action === "SELL_TO_CLOSE"
        ? "long"
        : "short";
    const key = JSON.stringify([
      e.accountId,
      optionContractKey(e.contract),
      direction,
    ]);
    const group = groups.get(key);
    if (group) group.push(e);
    else groups.set(key, [e]);
  }
  const matches: OptionMatch[] = [],
    openLots: {
      openingId: string;
      accountId: string;
      contractKey: string;
      direction: "long" | "short";
      remainingQuantity: Decimal;
    }[] = [];
  for (const rows of groups.values()) {
    const multipliers = new Set(
      rows.flatMap((e) =>
        e.contract.multiplier.value === null
          ? []
          : [e.contract.multiplier.value],
      ),
    );
    if (multipliers.size > 1) {
      for (const e of rows)
        issues.push({
          accountId: e.accountId,
          transactionId: e.transactionId,
          field: "multiplier",
          code: "conflicting_contract_multiplier",
          severity: "blocking",
        });
      continue;
    }
    const allTimed = rows.every((e) => e.instant !== null);
    const sorted = [...rows].sort((a, b) =>
      allTimed
        ? a.instant!.localeCompare(b.instant!)
        : a.tradeDate.localeCompare(b.tradeDate) ||
          (a.instant || "").localeCompare(b.instant || ""),
    );
    const hasCloses = sorted.some((e) => e.action.endsWith("CLOSE"));
    const dates = new Map<
      string,
      { count: number; missingTime: boolean; times: Set<string>; tied: boolean }
    >();
    for (const e of sorted) {
      const date = dates.get(e.tradeDate) || {
        count: 0,
        missingTime: false,
        times: new Set<string>(),
        tied: false,
      };
      date.count++;
      if (e.instant) {
        date.tied ||= date.times.has(e.instant);
        date.times.add(e.instant);
      } else date.missingTime = true;
      dates.set(e.tradeDate, date);
    }
    const ambiguous =
      hasCloses &&
      ([...dates.values()].some(
        (date) => date.count > 1 && (date.missingTime || date.tied),
      ) ||
        sorted.some(
          (e, index) =>
            e.instant !== null && e.instant === sorted[index - 1]?.instant,
        ));
    if (ambiguous) {
      for (const e of sorted)
        issues.push({
          accountId: e.accountId,
          transactionId: e.transactionId,
          field: "trade_date",
          code: "ambiguous_execution_order",
          severity: "blocking",
        });
      continue;
    }
    const lots: { execution: OptionExecution; remaining: Decimal }[] = [];
    for (const e of sorted) {
      if (e.action.endsWith("OPEN")) {
        lots.push({ execution: e, remaining: e.quantity });
        continue;
      }
      let remaining = e.quantity;
      for (const lot of lots) {
        if (compareDecimal(remaining, zero) <= 0) break;
        if (compareDecimal(lot.remaining, zero) <= 0) continue;
        const quantity =
          compareDecimal(lot.remaining, remaining) < 0
            ? lot.remaining
            : remaining;
        matches.push({
          openingId: lot.execution.id,
          closingId: e.id,
          accountId: e.accountId,
          contractKey: optionContractKey(e.contract)!,
          direction: e.action === "SELL_TO_CLOSE" ? "long" : "short",
          quantity,
        });
        lot.remaining = subtractDecimal(lot.remaining, quantity);
        remaining = subtractDecimal(remaining, quantity);
      }
      if (compareDecimal(remaining, zero) > 0)
        issues.push({
          accountId: e.accountId,
          transactionId: e.transactionId,
          field: "quantity",
          code: "close_exceeds_known_open_quantity",
          severity: "blocking",
        });
    }
    for (const lot of lots) {
      if (compareDecimal(lot.remaining, zero) <= 0) continue;
      openLots.push({
        openingId: lot.execution.id,
        accountId: lot.execution.accountId,
        contractKey: optionContractKey(lot.execution.contract)!,
        direction: lot.execution.action === "BUY_TO_OPEN" ? "long" : "short",
        remainingQuantity: lot.remaining,
      });
      if (lot.execution.contract.expiration.value! < asOfDay)
        issues.push({
          accountId: lot.execution.accountId,
          transactionId: lot.execution.transactionId,
          field: "expiration",
          code: "expired_contract_without_reconciled_outcome",
          severity: "blocking",
        });
    }
  }
  return {
    executions: executions.filter((e) => !conflictingAccounts.has(e.accountId)),
    matches,
    openLots,
    events,
    issues,
    reconciliationStatus: issues.some((i) => i.severity === "blocking")
      ? ("needs-review" as const)
      : ("quantities-reconciled" as const),
    accountingStatus: "not-calculated" as const,
  };
}
