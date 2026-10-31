import { createHash } from "node:crypto";
import {
  decimalField,
  currencyField,
  financialDate,
} from "@/lib/financial/fields";
import { absoluteDecimal, addDecimal, decimal } from "@/lib/financial/decimal";
import { unavailableDelta } from "@/lib/financial/types";
import type { Provenance } from "@/lib/financial/types";
import type { NormalizedTransaction } from "@/lib/financial/transactions";
import { normalizeOptionContract } from "@/lib/options/contracts";
import type { OptionAction } from "@/lib/options/types";
import type { OptionsHistory } from "@/lib/options/analytics-types";
import type {
  CsvActivity,
  ImportReconciliation,
} from "./wealthsimple-activity";
import { activityType } from "@/lib/financial/activity-types";

const zero = decimal("0")!;
export function csvOptionHistory(
  histories: OptionsHistory[],
  activities: CsvActivity[],
  mappings: Map<string, Set<string>>,
) {
  const counts: Pick<
    ImportReconciliation,
    | "optionsSource"
    | "csvOptionRows"
    | "overlappingApiOptions"
    | "unallocatedAccountFees"
  > = {
    csvOptionRows: 0,
    overlappingApiOptions: 0,
    unallocatedAccountFees: 0,
  };
  const frequencies = new Map<string, number>();
  for (const row of activities)
    frequencies.set(
      row.fingerprint,
      (frequencies.get(row.fingerprint) || 0) + 1,
    );
  const results = histories.map((history) => {
    const source = [...mappings].find(
      ([, ids]) => ids.size === 1 && ids.has(history.accountId),
    );
    if (!source || history.issues.length) return history;
    const all = activities.filter((r) => r.accountId === source[0]);
    const dated = all
      .flatMap((r) => (r.activity.date ? [r.activity.date] : []))
      .sort();
    if (!dated.length) return history;
    const options = all.filter((r) => r.option);
    if (!options.length) return history;
    const earliest = dated[0],
      latest = dated.at(-1)!;
    const outside = (t: NormalizedTransaction) =>
      !t.tradeDate.day ||
      t.tradeDate.day < earliest ||
      t.tradeDate.day > latest;
    const records = history.records.filter((t) => {
      if (outside(t)) return true;
      if (t.optionRelated) {
        counts.overlappingApiOptions!++;
        return false;
      }
      if (t.type === "FEE" && !t.externalReferenceId) {
        counts.unallocatedAccountFees!++;
        return false;
      }
      return true;
    });
    for (const row of options) {
      const r = row.activity;
      const p = (field: string): Provenance => ({
        provider: "wealthsimple-csv",
        field,
        recordId: `row-${r.row}`,
        method:
          "CSV-covered-period trade ledger. Opening/closing classification derived from reported BUY/SELL and LONG/SHORT side; export-local ordering is not a UTC timestamp.",
      });
      const currency = currencyField(r.currency, p("currency"));
      const money = (value: unknown, field: string) => ({
        amount: decimalField(value, p(field)),
        currency,
      });
      const eventType = activityType(row.activityType.toUpperCase());
      const type = [
        "OPTIONEXPIRATION",
        "OPTIONASSIGNMENT",
        "OPTIONEXERCISE",
      ].includes(eventType)
        ? eventType
        : ["BUY", "SELL"].includes(r.action)
          ? r.action
          : r.explicitAction
            ? r.action.startsWith("BUY")
              ? "BUY"
              : "SELL"
            : activityType(r.action.toUpperCase());
      const action = (
        r.explicitAction ? r.action : r.candidateAction || "unknown"
      ) as OptionAction;
      const contract = normalizeOptionContract(
        { symbol: r.symbol, referenceDay: r.date },
        "activity",
      );
      const counterpart = history.records.filter(
        (t) =>
          t.option?.symbol?.replace(/\s+/g, "") === r.symbol &&
          t.tradeDate.day === r.date &&
          t.quantity.value !== null &&
          r.quantity !== null &&
          absoluteDecimal(t.quantity.value) === absoluteDecimal(r.quantity),
      );
      // A missing CSV settlement amount/fee is not zero. For expirations only,
      // accept an explicitly zero API event with the same contract/date/quantity.
      const settlement = counterpart.filter(
        (t) =>
          t.type === type &&
          t.cashFlow.amount.value === zero &&
          t.fee.amount.value === zero,
      );
      const event = settlement.length === 1 ? settlement[0] : null;
      const net =
        r.netCash !== null
          ? money(r.netCash, "net_cash_amount")
          : event?.cashFlow || money(null, "net_cash_amount");
      const fee =
        r.commission !== null
          ? money(r.commission, "commission")
          : event?.fee || money(null, "commission");
      const apiPrice =
        counterpart.length === 1 &&
        counterpart[0].price.amount.status === "confirmed" &&
        counterpart[0].price.currency.value === r.currency
          ? counterpart[0].price
          : money(null, "unit_price_quote_basis_unverified");
      const gross = money(
        r.netCash !== null && r.commission !== null
          ? addDecimal(r.netCash, r.commission)
          : null,
        "net_cash_amount + commission",
      );
      if (gross.amount.value !== null)
        gross.amount = {
          status: "calculated",
          value: gross.amount.value,
          provenance: {
            provider: "application",
            field: "gross_premium",
            method: "CSV-reported net cash plus reported commission.",
          },
        };
      const tradeDate = financialDate(r.date);
      if (row.localTime && r.date)
        tradeDate.sourceOrder = {
          clock: "wealthsimple-export-local",
          key: `${r.date}T${row.localTime}`,
        };
      records.push({
        id: `csv-option-${createHash("sha256").update(row.fingerprint).digest("hex")}`,
        accountId: history.accountId,
        securityId: null,
        ticker: null,
        securityCurrency: null,
        type,
        direction:
          type === "BUY" ? "buy" : type === "SELL" ? "sell" : "unknown",
        optionAction: action,
        option: contract,
        optionRelated: true,
        tradeDate,
        settlementDate: financialDate(null),
        quantity: decimalField(r.quantity, p("quantity")),
        price: apiPrice,
        cashFlow: net,
        fee,
        netAmount: net,
        grossAmount: gross,
        cashConvention:
          r.netCash !== null && r.commission !== null
            ? "reported-net"
            : "unspecified",
        fxRate: decimalField(null, p("fx_rate")),
        externalReferenceId:
          counterpart.length === 1 ? counterpart[0].externalReferenceId : null,
        description: "Imported option activity",
        entryDelta: unavailableDelta(),
        issues:
          (frequencies.get(row.fingerprint) || 0) > 1
            ? [
                {
                  code: "csv_duplicate_requires_review",
                  field: "source",
                  severity: "blocking",
                },
              ]
            : [],
        importEvidence: {
          source: "wealthsimple-csv",
          row: r.row,
          actionMethod: r.explicitAction
            ? "explicit"
            : action !== "unknown"
              ? "source-side"
              : "unavailable",
        },
        sourceValues: {
          units: r.quantity,
          price: r.price,
          amount: r.netCash,
          fee: r.commission,
          fxRate: null,
        },
      });
      if (
        counterpart.length === 1 &&
        counterpart[0].optionAction !== "unknown" &&
        action !== "unknown" &&
        counterpart[0].optionAction !== action
      )
        records.at(-1)!.issues.push({
          code: "csv_source_action_conflict",
          field: "optionAction",
          severity: "blocking",
        });
      counts.csvOptionRows!++;
    }
    return { ...history, records };
  });
  if (counts.csvOptionRows) counts.optionsSource = "csv";
  return { histories: results, counts };
}
