import type { OptionsCurrencyPolicy } from "@/lib/config";
import {
  absoluteDecimal,
  addDecimal,
  compareDecimal,
  decimal,
  divideDecimal,
  multiplyDecimal,
  subtractDecimal,
  type Decimal,
} from "@/lib/financial/decimal";
import type { NormalizedTransaction } from "@/lib/financial/transactions";
import { optionContractKey } from "./contracts";
import { reconcileOptionExecutions } from "./reconcile-executions";
import { executionCash } from "./execution-cash";
import { applyOptionsCurrency } from "./currency";
import type {
  AnalyticsTrade,
  JournalExecution,
  OptionsHistory,
  OptionsLedger,
} from "./analytics-types";
const zero = decimal("0")!;
const sum = (items: Decimal[]) => items.reduce(addDecimal, zero);
const groupKey = (t: NormalizedTransaction) =>
  t.option && optionContractKey(t.option);

function prepareExpirations(records: NormalizedTransaction[]) {
  const exposure = new Map<string, { long: Decimal; short: Decimal }>();
  const prepared = [...records].sort(
    (a, b) =>
      (a.tradeDate.day || "").localeCompare(b.tradeDate.day || "") ||
      (a.tradeDate.sourceOrder?.key || a.tradeDate.instant || "").localeCompare(
        b.tradeDate.sourceOrder?.key || b.tradeDate.instant || "",
      ),
  );
  return prepared.map((t) => {
    const key = groupKey(t),
      qty =
        t.quantity.value === null ? null : absoluteDecimal(t.quantity.value);
    if (!key || qty === null || !t.tradeDate.day) return t;
    const sides = exposure.get(key) || { long: zero, short: zero };
    let result = t;
    if (
      t.type === "OPTIONEXPIRATION" &&
      t.option?.expiration.value &&
      t.tradeDate.day >= t.option.expiration.value &&
      t.cashFlow.amount.value === zero &&
      t.fee.amount.value === zero &&
      t.cashFlow.currency.value &&
      t.issues.length === 0
    ) {
      const side =
        compareDecimal(sides.long, zero) > 0 && sides.short === zero
          ? "long"
          : compareDecimal(sides.short, zero) > 0 && sides.long === zero
            ? "short"
            : null;
      if (
        side &&
        compareDecimal(qty, sides[side]) <= 0 &&
        compareDecimal(qty, zero) > 0
      ) {
        result = {
          ...t,
          type: side === "long" ? "SELL" : "BUY",
          optionAction: side === "long" ? "SELL_TO_CLOSE" : "BUY_TO_CLOSE",
        };
      }
    }
    if (
      result.optionAction !== "unknown" &&
      !result.issues.some((i) => i.severity === "blocking")
    ) {
      const side =
        result.optionAction === "BUY_TO_OPEN" ||
        result.optionAction === "SELL_TO_CLOSE"
          ? "long"
          : "short";
      sides[side] = result.optionAction.endsWith("OPEN")
        ? addDecimal(sides[side], qty)
        : subtractDecimal(sides[side], qty);
      exposure.set(key, sides);
    }
    return result;
  });
}

function emptyTrade(
  id: string,
  accountId: string,
  ticker: string,
): AnalyticsTrade {
  return {
    id,
    accountId,
    ticker,
    contract: null,
    direction: "unknown",
    openedOn: null,
    observedOn: null,
    closedOn: null,
    openedQuantity: zero,
    closedQuantity: zero,
    remainingQuantity: zero,
    status: "needs-review",
    currency: null,
    entryPremium: null,
    exitPremium: null,
    fees: null,
    premiumReceived: null,
    premiumPaid: null,
    realizedPnl: null,
    entryDte: null,
    outcome: "unclassified",
    executions: [],
    events: [],
    realizations: [],
    issues: [],
  };
}
function weightedPrice(rows: JournalExecution[]) {
  if (!rows.length || rows.some((e) => e.price === null)) return null;
  const quantity = sum(rows.map((e) => e.quantity));
  return quantity === zero
    ? null
    : divideDecimal(
        sum(rows.map((e) => multiplyDecimal(e.price!, e.quantity))),
        quantity,
      );
}

export function buildOptionsLedger(
  histories: OptionsHistory[],
  asOf: string,
  policy: OptionsCurrencyPolicy = "reported",
): OptionsLedger {
  const trades: AnalyticsTrade[] = [],
    issues: OptionsLedger["issues"] = [];
  for (const sourceHistory of histories) {
    const history = {
      ...sourceHistory,
      records: sourceHistory.records.map((row) =>
        applyOptionsCurrency(row, policy),
      ),
    };
    const identical = new Set<string>();
    const originals = history.records.filter((t) => {
      if (!t.optionRelated) return false;
      if (!t.id) return true;
      const fingerprint = JSON.stringify(t);
      if (identical.has(fingerprint)) return false;
      identical.add(fingerprint);
      return true;
    });
    const originalById = new Map(
      originals.filter((t) => t.id).map((t) => [t.id!, t]),
    );
    const prepared = prepareExpirations(originals);
    const reconciliation = reconcileOptionExecutions(prepared, asOf);
    const accountIssues = [...history.issues];
    if (
      originals.length &&
      history.records.some(
        (t) => t.type === "FEE" && !t.optionRelated && !t.externalReferenceId,
      )
    )
      accountIssues.push(
        "Unallocated fee activity prevents verified options accounting for this account.",
      );
    const affected = new Map<string, string[]>();
    const addIssue = (key: string, reason: string) =>
      affected.set(key, [...(affected.get(key) || []), reason]);
    for (const issue of reconciliation.issues) {
      if (issue.severity !== "blocking") continue;
      const t = issue.transactionId
        ? originalById.get(issue.transactionId)
        : null;
      const key = t ? groupKey(t) : null;
      if (key) addIssue(key, issue.code.replaceAll("_", " "));
      else accountIssues.push(issue.code.replaceAll("_", " "));
    }
    for (const t of history.records.filter(
      (t) =>
        !t.optionRelated &&
        ["FEE", "TAX", "ADJUSTMENT"].includes(t.type) &&
        t.externalReferenceId,
    )) {
      for (const option of originals.filter(
        (o) => o.externalReferenceId === t.externalReferenceId,
      )) {
        const key = groupKey(option);
        if (key)
          addIssue(
            key,
            "A related fee, tax or cash adjustment needs explicit allocation; it is not counted twice.",
          );
      }
    }
    for (const reason of [...new Set(accountIssues)])
      issues.push({ accountId: history.accountId, reason });
    const preparedById = new Map(
      prepared.filter((t) => t.id).map((t) => [t.id!, t]),
    );
    const executions = reconciliation.executions.map((e) => {
      const source = preparedById.get(e.transactionId)!;
      const cash = executionCash(source, policy);
      const chargeRisk = [
        ...accountIssues,
        ...(affected.get(optionContractKey(e.contract)!) || []),
      ].some((reason) => /fee|charge|adjustment/i.test(reason));
      if (chargeRisk) {
        cash.premium = null;
        cash.net = null;
        cash.convention = "unresolved";
        cash.issues.push(
          "Related or unallocated charges require premium reconciliation.",
        );
      }
      return {
        ...e,
        csvActionMethod: source.importEvidence?.actionMethod,
        price:
          source.price.amount.status === "confirmed"
            ? source.price.amount.value
            : null,
        cash,
        kind:
          originalById.get(e.transactionId)?.type === "OPTIONEXPIRATION"
            ? ("expiration" as const)
            : ("trade" as const),
      };
    });
    const groups = new Map<string, JournalExecution[]>();
    for (const e of executions) {
      const direction =
        e.action === "BUY_TO_OPEN" || e.action === "SELL_TO_CLOSE"
          ? "long"
          : "short";
      const key = JSON.stringify([optionContractKey(e.contract), direction]);
      const rows = groups.get(key);
      if (rows) rows.push(e);
      else groups.set(key, [e]);
    }
    const used = new Set<string>();
    for (const rows of groups.values()) {
      const localClock = rows[0].sourceOrder?.clock;
      const local =
        !!localClock && rows.every((e) => e.sourceOrder?.clock === localClock);
      const time = (e: JournalExecution) =>
        local ? e.sourceOrder!.key : e.instant;
      const allTimed = rows.every((e) => time(e) !== null);
      rows.sort((a, b) =>
        allTimed
          ? time(a)!.localeCompare(time(b)!)
          : a.tradeDate.localeCompare(b.tradeDate) ||
            (a.instant || "").localeCompare(b.instant || ""),
      );
      const key = optionContractKey(rows[0].contract)!;
      let current: AnalyticsTrade | null = null;
      const cycles: AnalyticsTrade[] = [];
      for (const e of rows) {
        used.add(e.transactionId);
        if (!current) {
          current = emptyTrade(
            e.id,
            history.accountId,
            e.contract.underlyingTicker || e.contract.occRoot || "Unknown",
          );
          current.contract = e.contract;
          current.direction =
            e.action === "BUY_TO_OPEN" || e.action === "SELL_TO_CLOSE"
              ? "long"
              : "short";
          current.issues = [...accountIssues, ...(affected.get(key) || [])];
          cycles.push(current);
        }
        current.executions.push(e);
        if (e.action.endsWith("OPEN")) {
          current.openedOn ||= e.tradeDate;
          current.openedQuantity = addDecimal(
            current.openedQuantity!,
            e.quantity,
          );
          current.remainingQuantity = addDecimal(
            current.remainingQuantity!,
            e.quantity,
          );
        } else {
          current.closedQuantity = addDecimal(
            current.closedQuantity!,
            e.quantity,
          );
          current.remainingQuantity = subtractDecimal(
            current.remainingQuantity!,
            e.quantity,
          );
        }
        if (
          current.remainingQuantity === zero &&
          current.openedQuantity !== zero
        ) {
          current.closedOn = e.tradeDate;
          current = null;
        }
      }
      for (const trade of cycles) {
        const currencies = [
          ...new Set(trade.executions.map((e) => e.cash.currency)),
        ];
        trade.currency = currencies.length === 1 ? currencies[0] : null;
        const cash = trade.executions.filter((e) => e.cash.premium !== null);
        if (trade.currency && cash.length) {
          trade.premiumReceived = sum(
            cash
              .filter((e) => compareDecimal(e.cash.premium!, zero) > 0)
              .map((e) => e.cash.premium!),
          );
          trade.premiumPaid = absoluteDecimal(
            sum(
              cash
                .filter((e) => compareDecimal(e.cash.premium!, zero) < 0)
                .map((e) => e.cash.premium!),
            ),
          );
        }
        if (currencies.length !== 1 || trade.currency === null)
          trade.issues.push(
            "Execution currencies differ or are missing; no FX conversion is assumed.",
          );
        trade.issues.push(...trade.executions.flatMap((e) => e.cash.issues));
        trade.issues = [...new Set(trade.issues)];
        if (!trade.openedOn) {
          trade.openedQuantity = null;
          trade.remainingQuantity = null;
        }
        const opening = trade.executions.filter((e) =>
            e.action.endsWith("OPEN"),
          ),
          closing = trade.executions.filter((e) => e.action.endsWith("CLOSE"));
        trade.entryPremium = trade.currency ? weightedPrice(opening) : null;
        trade.exitPremium = trade.currency
          ? weightedPrice(closing.filter((e) => e.kind === "trade"))
          : null;
        if (
          trade.openedOn &&
          (trade.contract?.expiration.status === "confirmed" ||
            trade.contract?.expiration.status === "calculated")
        ) {
          const dte = Math.round(
            (Date.parse(trade.contract.expiration.value) -
              Date.parse(trade.openedOn)) /
              86400000,
          );
          if (dte >= 0) trade.entryDte = dte;
        }
        const hasIssues = trade.issues.length > 0;
        trade.status = hasIssues
          ? "needs-review"
          : trade.remainingQuantity === zero
            ? "closed"
            : trade.closedQuantity === zero
              ? "open"
              : "partial";
        if (!hasIssues) {
          trade.fees = sum(trade.executions.map((e) => e.cash.fee!));
          const allocations = new Map<
            string,
            { net: Decimal; fees: Decimal; quantity: Decimal }
          >();
          const executionIds = new Set(trade.executions.map((e) => e.id));
          const matches = reconciliation.matches.filter(
            (m) =>
              executionIds.has(m.openingId) && executionIds.has(m.closingId),
          );
          // Allocate each execution's source net cash/fee over matched quantities.
          // Use a residual on the final slice, retaining any still-open allocation.
          for (const e of trade.executions) {
            let netLeft = e.cash.net!,
              feeLeft = e.cash.fee!,
              qtyLeft = e.quantity;
            for (const [index, match] of matches.entries()) {
              if (match.openingId !== e.id && match.closingId !== e.id)
                continue;
              const net =
                match.quantity === qtyLeft
                  ? netLeft
                  : divideDecimal(
                      multiplyDecimal(e.cash.net!, match.quantity),
                      e.quantity,
                    );
              const fees =
                match.quantity === qtyLeft
                  ? feeLeft
                  : divideDecimal(
                      multiplyDecimal(e.cash.fee!, match.quantity),
                      e.quantity,
                    );
              allocations.set(`${index}:${e.id}`, {
                net,
                fees,
                quantity: match.quantity,
              });
              netLeft = subtractDecimal(netLeft, net);
              feeLeft = subtractDecimal(feeLeft, fees);
              qtyLeft = subtractDecimal(qtyLeft, match.quantity);
            }
          }
          matches.forEach((match, index) => {
            const open = allocations.get(`${index}:${match.openingId}`)!,
              close = allocations.get(`${index}:${match.closingId}`)!;
            const closingExecution = trade.executions.find(
              (e) => e.id === match.closingId,
            )!;
            trade.realizations.push({
              date: closingExecution.tradeDate,
              pnl: addDecimal(open.net, close.net),
              fees: addDecimal(open.fees, close.fees),
              quantity: match.quantity,
              openingId: match.openingId,
              closingId: match.closingId,
            });
          });
          trade.realizedPnl = trade.realizations.length
            ? sum(trade.realizations.map((r) => r.pnl))
            : null;
          if (trade.status === "closed" && trade.realizedPnl !== null)
            trade.outcome =
              compareDecimal(trade.realizedPnl, zero) > 0
                ? "win"
                : compareDecimal(trade.realizedPnl, zero) < 0
                  ? "loss"
                  : "breakeven";
        }
        trades.push(trade);
      }
    }
    for (const [index, t] of originals.entries()) {
      if (t.id && used.has(t.id)) continue;
      if (t.id) used.add(t.id);
      const row = emptyTrade(
        JSON.stringify([history.accountId, t.id || index, "unresolved"]),
        history.accountId,
        t.option?.underlyingTicker || t.option?.occRoot || "Unknown",
      );
      row.contract = t.option;
      row.currency = t.cashFlow.currency.value;
      row.openedQuantity = null;
      row.closedQuantity = null;
      row.remainingQuantity = null;
      row.observedOn = t.tradeDate.day;
      row.openedOn = t.optionAction.endsWith("OPEN") ? t.tradeDate.day : null;
      row.events = [
        {
          type: t.type,
          date: t.tradeDate.day,
          quantity: t.quantity.value,
          amount: t.cashFlow.amount.value,
          fee: t.fee.amount.value,
          currency: t.cashFlow.currency.value,
        },
      ];
      row.issues = [
        ...new Set([
          ...accountIssues,
          ...(groupKey(t) ? affected.get(groupKey(t)!) || [] : []),
          "Unmatched or unresolved option activity; excluded from performance.",
        ]),
      ];
      trades.push(row);
    }
  }
  return { trades, issues };
}
