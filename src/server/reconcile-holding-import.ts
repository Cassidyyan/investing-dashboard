import "server-only";
import type { TransactionHistory } from "@/lib/returns/holding-returns";
import type { CsvActivity } from "@/lib/imports/wealthsimple-activity";
import { reconcileCsvActivities } from "@/lib/imports/reconcile-activities";
import { decimalNumber } from "@/lib/financial/decimal";
import type { AccountData } from "@/lib/types";

export function reconcileHoldingImport(
  histories: TransactionHistory[],
  activities: CsvActivity[],
  accounts: AccountData[] = [],
) {
  const input = histories.map((h) => ({
    ...h,
    records:
      h.sourceRecords ||
      h.transactions.flatMap((t) => (t.sourceRecord ? [t.sourceRecord] : [])),
  }));
  const merged = reconcileCsvActivities(input, activities, "shares");
  const results = histories.map((h, index) => ({
    ...h,
    transactions: [
      ...h.transactions.map((t) => {
        const source = merged.histories[index].records.find(
          (r) => r.id === t.id,
        );
        if (!source?.importEvidence) return t;
        return {
          ...t,
          sourceRecord: source,
          amount: decimalNumber(source.cashFlow.amount.value),
          fee: decimalNumber(source.fee.amount.value),
          reportedNet: source.cashConvention === "reported-net",
          transferDirection: source.importEvidence.transferDirection,
          note: "Wealthsimple CSV reconciliation: uniquely matched source net cash and commission; no duplicate execution or extra fee counted.",
          ...(source.issues.some((i) => i.code === "csv_action_conflict")
            ? {
                issue:
                  "CSV source conflicts with brokerage activity; reconciliation is required.",
              }
            : {}),
        };
      }),
      ...merged.histories[index].records
        .filter(
          (r) =>
            r.importEvidence &&
            !r.optionRelated &&
            !h.transactions.some((t) => t.id === r.id),
        )
        .map((r) => {
          const settlement = ["OPTIONASSIGNMENT", "OPTIONEXERCISE"].includes(
            r.type,
          );
          const amount = decimalNumber(r.cashFlow.amount.value),
            units = decimalNumber(r.quantity.value);
          const currency = r.cashFlow.currency.value || "Unknown";
          const type =
            settlement && amount !== null && amount !== 0
              ? amount < 0
                ? "BUY"
                : "SELL"
              : r.type;
          return {
            sourceRecord: r,
            id: r.id!,
            symbol: r.ticker!,
            currency,
            date: r.tradeDate.day,
            order: r.tradeDate.raw || "",
            type,
            units: units === null ? null : Math.abs(units),
            amount,
            price: decimalNumber(r.price.amount.value),
            fee: decimalNumber(r.fee.amount.value),
            securityCurrency: r.securityCurrency || undefined,
            reportedNet: true,
            transferDirection: r.importEvidence?.transferDirection,
            fxConvertible:
              !!r.securityCurrency &&
              r.securityCurrency !== currency &&
              ["CAD", "USD"].includes(currency) &&
              ["CAD", "USD"].includes(r.securityCurrency),
            ...(r.securityCurrency && r.securityCurrency !== currency
              ? {
                  issue:
                    "Transaction settlement currency differs from security currency; historical FX reconciliation is required.",
                }
              : {}),
            note: "Wealthsimple CSV: additional source activity in a uniquely matched account; no overlapping API execution was found. Net cash includes reported commission.",
          };
        }),
    ],
  }));
  let accepted = 0,
    pending = 0;
  for (const h of results) {
    const account = accounts.find((a) => a.account.id === h.accountId);
    const groups = new Map<string, typeof h.transactions>();
    for (const t of h.transactions.filter((t) => t.id.startsWith("csv-")))
      groups.set(t.symbol, [...(groups.get(t.symbol) || []), t]);
    const rejected = new Set<string>();
    for (const [symbol, additions] of groups) {
      const prior = h.transactions.filter(
        (t) => t.symbol === symbol && !t.id.startsWith("csv-"),
      );
      const all = [...prior, ...additions];
      const held =
        account?.positions.status === "ok"
          ? account.positions.data.rows.filter((p) => p.symbol === symbol)
          : null;
      // CSV-only fills require independent ending-share evidence. Unknown
      // transfers/corporate actions cannot establish a zero starting inventory.
      const valid =
        held &&
        !h.issues.length &&
        all.every(
          (t) =>
            [
              "BUY",
              "SELL",
              "DIVIDEND",
              "SUBSTITUTE_DIVIDEND",
              "TAX",
              "FEE",
            ].includes(t.type) &&
            !t.issue &&
            !!t.date &&
            !(
              ["BUY", "SELL"].includes(t.type) &&
              (t.units === null || t.units <= 0)
            ),
        ) &&
        held.every((p) => p.units !== null && p.units >= 0);
      const units = all.reduce(
        (n, t) =>
          n +
          (t.type === "BUY"
            ? t.units || 0
            : t.type === "SELL"
              ? -(t.units || 0)
              : 0),
        0,
      );
      const current = held?.reduce((n, p) => n + (p.units || 0), 0) || 0;
      if (
        valid &&
        Math.abs(units - current) <=
          Math.max(0.00001, Math.abs(current) * 0.000001)
      )
        accepted += additions.length;
      else {
        pending += additions.length;
        for (const t of additions) rejected.add(t.id);
      }
    }
    h.transactions = h.transactions.filter((t) => !rejected.has(t.id));
  }
  return {
    report: { ...merged.report, added: accepted, pendingAdditional: pending },
    histories: results,
  };
}
