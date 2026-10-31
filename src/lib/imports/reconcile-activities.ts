import {
  absoluteDecimal,
  addDecimal,
  compareDecimal,
  decimal,
  subtractDecimal,
} from "@/lib/financial/decimal";
import { decimalField, currencyField } from "@/lib/financial/fields";
import type { NormalizedTransaction } from "@/lib/financial/transactions";
import type {
  CsvActivity,
  ImportReconciliation,
} from "./wealthsimple-activity";
import type { OptionAction } from "@/lib/options/types";
import { activityType } from "@/lib/financial/activity-types";
import { financialDate } from "@/lib/financial/fields";
import { createHash } from "node:crypto";

const zero = decimal("0")!;
type History = {
  accountId: string;
  records: NormalizedTransaction[];
  issues: string[];
};
const same = (a: string | null, b: string | null) =>
  a !== null && b !== null && a === b;
const stockTypes = new Set(["cs", "ad", "ps", "et", "cef", "oef", "ut", "pm"]);
function preferTradeDate(records: NormalizedTransaction[], row: CsvActivity) {
  const exact = records.filter((t) => t.tradeDate.day === row.activity.date);
  return exact.length ? exact : records;
}
function csvType(row: CsvActivity): string {
  const action = row.activity.action.toUpperCase();
  const event = activityType(row.activityType.toUpperCase());
  if (
    ["OPTIONASSIGNMENT", "OPTIONEXERCISE", "OPTIONEXPIRATION"].includes(event)
  ) {
    if (row.option) return event;
    if (row.activity.netCash !== null && row.activity.netCash !== zero)
      return compareDecimal(row.activity.netCash, zero) < 0 ? "BUY" : "SELL";
    return event;
  }
  if (
    !row.option &&
    ["OPTIONASSIGNMENT", "OPTIONEXERCISE"].includes(activityType(action)) &&
    row.activity.netCash !== null &&
    row.activity.netCash !== zero
  )
    return compareDecimal(row.activity.netCash, zero) < 0 ? "BUY" : "SELL";
  if (["BUY", "SELL", "TRANSFER", "DIVIDEND", "TAX", "FEE"].includes(action))
    return action;
  if (/^BUY_TO_/.test(action)) return "BUY";
  if (/^SELL_TO_/.test(action)) return "SELL";
  return activityType(action);
}
function core(row: CsvActivity, t: NormalizedTransaction): boolean {
  const r = row.activity;
  if (
    !row.option &&
    t.securityType &&
    !["cs", "ad", "ps", "et", "cef", "oef", "ut", "pm"].includes(t.securityType)
  )
    return false;
  const symbols = row.option
    ? [t.option?.symbol?.replace(/\s+/g, "")]
    : [t.ticker, t.sourceMetadata?.rawSecuritySymbol];
  const type =
    !t.optionRelated &&
    ["OPTIONASSIGNMENT", "OPTIONEXERCISE"].includes(t.type) &&
    t.cashFlow.amount.value !== null &&
    t.cashFlow.amount.value !== zero
      ? compareDecimal(t.cashFlow.amount.value, zero) < 0
        ? "BUY"
        : "SELL"
      : t.type;
  return (
    (type === csvType(row) ||
      (!row.option &&
        !t.option &&
        ["cs", "ad", "ps", "et", "cef", "oef", "ut", "pm"].includes(
          t.securityType || "",
        ) &&
        [
          "OPTIONS_MULTILEG",
          "OPTIONS_SETTLEMENTS",
          "OPTIONASSIGNMENT",
        ].includes(t.type) &&
        ["BUY", "SELL"].includes(csvType(row))) ||
      (row.option &&
        t.type === "OPTIONS_MULTILEG" &&
        ["BUY", "SELL"].includes(csvType(row)))) &&
    !!r.date &&
    (t.tradeDate.day === r.date ||
      (!!row.settlementDate &&
        t.settlementDate.day === row.settlementDate &&
        !!t.tradeDate.day &&
        Math.abs(Date.parse(t.tradeDate.day) - Date.parse(r.date)) <=
          7 * 86400000)) &&
    symbols.includes(r.symbol) &&
    (t.optionRelated === row.option ||
      (!row.option &&
        !t.option &&
        ["cs", "ad", "ps", "et", "cef", "oef", "ut", "pm"].includes(
          t.securityType || "",
        ))) &&
    ((t.type === "TRANSFER" &&
      t.cashFlow.amount.value === zero &&
      t.fee.amount.value === zero) ||
      same(
        t.type === "TRANSFER" && t.cashFlow.amount.value === zero
          ? t.securityCurrency || t.cashFlow.currency.value
          : t.cashFlow.currency.value,
        r.currency,
      )) &&
    r.quantity !== null &&
    t.quantity.value !== null &&
    absoluteDecimal(t.quantity.value) === absoluteDecimal(r.quantity)
  );
}
function cashMatches(row: CsvActivity, t: NormalizedTransaction): boolean {
  const r = row.activity,
    amount = t.cashFlow.amount.value,
    fee = t.fee.amount.value;
  if (t.type === "TRANSFER" && amount === zero && fee === zero) return true;
  if (
    r.netCash === null ||
    amount === null ||
    r.commission === null ||
    compareDecimal(r.commission, zero) < 0
  )
    return false;
  if (fee !== null && fee !== r.commission) return false;
  return (
    amount === r.netCash ||
    (fee !== null && subtractDecimal(amount, fee) === r.netCash)
  );
}
function enrich(
  row: CsvActivity,
  t: NormalizedTransaction,
): NormalizedTransaction {
  const r = row.activity;
  if (
    t.type === "TRANSFER" &&
    t.cashFlow.amount.value === zero &&
    t.fee.amount.value === zero
  )
    return {
      ...t,
      importEvidence: {
        source: "wealthsimple-csv",
        row: r.row,
        actionMethod: "unavailable",
        ...(r.quantity !== null && r.quantity !== zero
          ? {
              transferDirection:
                compareDecimal(r.quantity, zero) < 0 ? "out" : "in",
            }
          : {}),
      },
    };
  const p = (field: string) => ({
    provider: "wealthsimple-csv" as const,
    field,
    recordId: `row-${r.row}`,
    method:
      "Unique overlapping activity matched by date, contract/security, currency, quantity and cash; account mapping corroborated by multiple executions.",
  });
  const currency = currencyField(r.currency, p("currency"));
  const net = {
    amount: decimalField(r.netCash, p("net_cash_amount")),
    currency,
  };
  const fee = { amount: decimalField(r.commission, p("commission")), currency };
  const premium =
    r.netCash !== null && r.commission !== null
      ? addDecimal(r.netCash, r.commission)
      : null;
  const supplied = row.option
    ? r.explicitAction
      ? r.action
      : r.candidateAction
    : null;
  const action =
    supplied &&
    ["BUY_TO_OPEN", "BUY_TO_CLOSE", "SELL_TO_OPEN", "SELL_TO_CLOSE"].includes(
      supplied,
    )
      ? (supplied as OptionAction)
      : "unknown";
  // Preserve an existing action; disagreement is a blocking source conflict.
  const conflict =
    t.optionAction !== "unknown" &&
    action !== "unknown" &&
    t.optionAction !== action;
  return {
    ...t,
    ...(!row.option && !t.option && ["BUY", "SELL"].includes(csvType(row))
      ? { type: csvType(row), optionRelated: false }
      : {}),
    type:
      (t.type === "OPTIONS_MULTILEG" ||
        (!row.option &&
          ["OPTIONS_SETTLEMENTS", "OPTIONASSIGNMENT"].includes(t.type))) &&
      ["BUY", "SELL"].includes(csvType(row))
        ? csvType(row)
        : t.type,
    optionAction: t.optionAction === "unknown" ? action : t.optionAction,
    cashFlow: net,
    netAmount: net,
    fee,
    grossAmount: {
      amount:
        premium === null
          ? decimalField(null, p("net_cash_amount + commission"))
          : {
              status: "calculated",
              value: premium,
              provenance: {
                provider: "application",
                field: "gross_premium",
                method: "CSV-reported net cash plus reported commission.",
              },
            },
      currency,
    },
    cashConvention: "reported-net",
    importEvidence: {
      source: "wealthsimple-csv",
      row: r.row,
      actionMethod: r.explicitAction
        ? "explicit"
        : action !== "unknown"
          ? "source-side"
          : "unavailable",
      ...(t.type === "TRANSFER" && r.quantity !== null && r.quantity !== zero
        ? {
            transferDirection:
              compareDecimal(r.quantity, zero) < 0
                ? ("out" as const)
                : ("in" as const),
          }
        : {}),
    },
    issues: [
      ...t.issues,
      ...(conflict
        ? [
            {
              code: "csv_action_conflict",
              field: "optionAction",
              severity: "blocking" as const,
            },
          ]
        : []),
    ],
  };
}

// Match before appending: a partial/conflicting overlap must never become a second
// fill. Only known securities in a uniquely corroborated account can be added.
export function reconcileCsvActivities<T extends History>(
  histories: T[],
  activities: CsvActivity[],
  scope: "all" | "shares" = "all",
) {
  const report: ImportReconciliation = {
    matched: 0,
    added: 0,
    conflicts: 0,
    unmatched: 0,
    mappedAccounts: 0,
  };
  const records = histories.flatMap((h) => (h.issues.length ? [] : h.records));
  const frequencies = new Map<string, number>();
  for (const row of activities)
    frequencies.set(
      row.fingerprint,
      (frequencies.get(row.fingerprint) || 0) + 1,
    );
  const usable = activities.filter(
    (r) =>
      r.accountId &&
      frequencies.get(r.fingerprint) === 1 &&
      r.activity.symbol &&
      r.activity.date,
  );
  const unique = new Map<CsvActivity, NormalizedTransaction>();
  const votes = new Map<string, Map<string, Set<string>>>();
  for (const row of usable) {
    if (!["BUY", "SELL"].includes(csvType(row))) continue;
    const matches = preferTradeDate(
      records.filter((t) => core(row, t) && cashMatches(row, t)),
      row,
    );
    if (matches.length !== 1 || !matches[0].id) continue;
    const t = matches[0];
    unique.set(row, t);
    const targets = votes.get(row.accountId) || new Map<string, Set<string>>();
    const ids = targets.get(t.accountId) || new Set<string>();
    ids.add(t.id!);
    targets.set(t.accountId, ids);
    votes.set(row.accountId, targets);
  }
  const accepted = new Map<string, Set<string>>();
  for (const [csvAccount, targets] of votes) {
    const proven = [...targets]
      .filter(([, ids]) => ids.size >= 3)
      .map(([id]) => id);
    for (const id of proven) {
      if (
        [...votes].some(
          ([other, ts]) => other !== csvAccount && (ts.get(id)?.size || 0) >= 3,
        )
      )
        continue;
      accepted.set(
        csvAccount,
        new Set([...(accepted.get(csvAccount) || []), id]),
      );
    }
  }
  report.mappedAccounts = accepted.size;
  const replacements = new Map<NormalizedTransaction, NormalizedTransaction>();
  const additions = new Map<string, NormalizedTransaction[]>();
  const claimed = new Set<NormalizedTransaction>();
  const ambiguousClaims = new Set<NormalizedTransaction>();
  for (const row of activities) {
    if (scope === "shares" && row.option) continue;
    if (
      !row.activity.symbol ||
      ![
        "BUY",
        "SELL",
        "TRANSFER",
        "DIVIDEND",
        "SUBSTITUTE_DIVIDEND",
        "TAX",
        "FEE",
        "OPTIONASSIGNMENT",
        "OPTIONEXERCISE",
      ].includes(csvType(row))
    )
      continue;
    if (!usable.includes(row) || !accepted.has(row.accountId)) {
      report.unmatched++;
      continue;
    }
    const scoped = records.filter(
      (t) => accepted.get(row.accountId)!.has(t.accountId) && core(row, t),
    );
    const matches = preferTradeDate(
      scoped.filter((t) => cashMatches(row, t)),
      row,
    );
    const match = unique.get(row);
    const t =
      match && matches.includes(match)
        ? match
        : matches.length === 1
          ? matches[0]
          : null;
    if (
      !t &&
      scoped.length === 0 &&
      !row.option &&
      csvType(row) !== "TRANSFER" &&
      accepted.get(row.accountId)!.size === 1
    ) {
      const target = [...accepted.get(row.accountId)!][0];
      const r = row.activity;
      const references = records.filter(
        (x) =>
          !x.optionRelated &&
          (!x.securityType || stockTypes.has(x.securityType)) &&
          [x.ticker, x.sourceMetadata?.rawSecuritySymbol].includes(r.symbol),
      );
      const reference =
        new Set(
          references.map((r) => JSON.stringify([r.ticker, r.securityCurrency])),
        ).size === 1
          ? references[0]
          : undefined;
      // Currency disagreement or a nearby dated counterpart needs review, not a
      // new execution. Export-local dates are not assumed to be UTC timestamps.
      const nearby = records.some(
        (x) =>
          x.accountId === target &&
          [x.ticker, x.sourceMetadata?.rawSecuritySymbol].includes(r.symbol) &&
          x.quantity.value !== null &&
          r.quantity !== null &&
          absoluteDecimal(x.quantity.value) === absoluteDecimal(r.quantity) &&
          !!x.tradeDate.day &&
          !!r.date &&
          Math.abs(Date.parse(x.tradeDate.day) - Date.parse(r.date)) <=
            7 * 86400000 &&
          (x.type === csvType(row) ||
            (!x.optionRelated &&
              ["OPTIONASSIGNMENT", "OPTIONEXERCISE"].includes(x.type) &&
              ["BUY", "SELL"].includes(csvType(row)))),
      );
      if (
        reference &&
        !nearby &&
        r.date &&
        r.currency &&
        r.netCash !== null &&
        r.quantity !== null &&
        r.commission !== null &&
        compareDecimal(r.commission, zero) >= 0
      ) {
        const provisional = {
          ...reference,
          accountId: target,
          id: `csv-${createHash("sha256").update(row.fingerprint).digest("hex")}`,
          type: csvType(row),
          tradeDate: financialDate(r.date),
          settlementDate: financialDate(null),
          optionAction: "unknown" as const,
          option: null,
          optionRelated: false,
          externalReferenceId: null,
          issues: [],
          quantity: decimalField(r.quantity, {
            provider: "wealthsimple-csv",
            field: "quantity",
          }),
          price: {
            amount: decimalField(r.price, {
              provider: "wealthsimple-csv",
              field: "unit_price",
            }),
            currency: currencyField(r.currency, {
              provider: "wealthsimple-csv",
              field: "currency",
            }),
          },
          description: "Imported brokerage activity",
          sourceValues: {
            units: r.quantity,
            price: r.price,
            amount: r.netCash,
            fee: r.commission,
            fxRate: null,
          },
        };
        const added = enrich(row, provisional);
        additions.set(target, [...(additions.get(target) || []), added]);
        report.added++;
        continue;
      }
    }
    if (t && claimed.has(t)) {
      const prior = replacements.get(t);
      if (prior && !prior.issues.some((i) => i.code === "csv_action_conflict"))
        report.matched--;
      replacements.delete(t);
      ambiguousClaims.add(t);
      report.conflicts++;
      continue;
    }
    if (!t || ambiguousClaims.has(t)) {
      if (scoped.length && !matches.length) report.conflicts++;
      else report.unmatched++;
      continue;
    }
    const merged = enrich(row, t);
    if (merged.issues.some((i) => i.code === "csv_action_conflict"))
      report.conflicts++;
    else report.matched++;
    replacements.set(t, merged);
    claimed.add(t);
  }
  return {
    accountMappings: accepted,
    histories: histories.map((h) => ({
      ...h,
      records: [
        ...h.records.map((t) => replacements.get(t) || t),
        ...(additions.get(h.accountId) || []),
      ],
    })),
    report,
  };
}
