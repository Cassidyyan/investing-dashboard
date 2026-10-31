import { expect, it } from "vitest";
import { normalizeTransaction } from "@/server/normalize-transactions";
import { normalizeSecurityTransaction } from "@/server/load-holding-returns";
import { parseWealthsimpleActivity } from "@/lib/imports/wealthsimple-activity";
import { reconcileCsvActivities } from "@/lib/imports/reconcile-activities";
import { reconcileHoldingImport } from "@/server/reconcile-holding-import";
import { buildOptionsLedger } from "@/lib/options/ledger";
import { calculateHoldingReturns } from "@/lib/returns/holding-returns";
import type { AccountData } from "@/lib/types";

const header =
  "effective_date,account_id,activity_type,activity_sub_type,symbol,currency,quantity,unit_price,commission,net_cash_amount,direction";
const stock = (i: number) => ({
  id: `stock-${i}`,
  type: "BUY",
  symbol: {
    symbol: "SYNTH",
    raw_symbol: "SYNTH",
    type: { code: "cs" },
    currency: { code: "USD" },
  },
  currency: { code: "USD" },
  units: 1,
  amount: -10,
  price: 10,
  fee: 0,
  trade_date: `2026-09-0${i}`,
});
const seeds = [1, 2, 3].map(stock);
const option = (
  id: string,
  type: string,
  amount: number,
  fee: number,
  day: number,
) => ({
  id,
  type,
  units: type === "SELL" ? -1 : 1,
  amount,
  fee,
  price: Math.abs(amount) / 100,
  currency: { code: "USD" },
  trade_date: `2026-09-0${day}`,
  option_symbol: {
    id: "synthetic-contract",
    ticker: "SYNTH261218C00100000",
    option_type: "CALL" as const,
    strike_price: 100,
    expiration_date: "2026-12-18",
    underlying_symbol: { symbol: "SYNTH" },
  },
});
const csvSeeds = [1, 2, 3].map(
  (i) =>
    `2026-09-0${i},PRIVATE_CSV_ACCOUNT,Trade,BUY,SYNTH,USD,1,10,0,-10,LONG`,
);
const parse = (rows: string[]) =>
  parseWealthsimpleActivity([header, ...rows].join("\n")).activities;
const history = (
  raw = [
    ...seeds,
    option("open", "SELL", 100, 2, 4),
    option("close", "BUY", -40, 1, 5),
  ],
) => [
  {
    accountId: "sdk-account",
    records: raw.map((t) => normalizeTransaction(t, "sdk-account")),
    issues: [] as string[],
  },
];
const optionRows = [
  "2026-09-04,PRIVATE_CSV_ACCOUNT,Trade,SELL,SYNTH261218C00100000,USD,-1,1,2,98,SHORT",
  "2026-09-05,PRIVATE_CSV_ACCOUNT,Trade,BUY,SYNTH261218C00100000,USD,1,0.4,1,-41,SHORT",
];

it("matches a corroborated account and enriches each option once with reported net cash and source-side actions", () => {
  const input = history(),
    result = reconcileCsvActivities(input, parse([...csvSeeds, ...optionRows]));
  expect(result.report).toMatchObject({
    mappedAccounts: 1,
    matched: 5,
    added: 0,
    conflicts: 0,
  });
  expect(result.histories[0].records).toHaveLength(5);
  expect(input[0].records[3].optionAction).toBe("unknown");
  const ledger = buildOptionsLedger(result.histories, "2026-10-31");
  expect(ledger.trades[0]).toMatchObject({
    status: "closed",
    realizedPnl: "57",
    fees: "3",
  });
  expect(ledger.trades[0].executions[0].csvActionMethod).toBe("source-side");
});
it("keeps repeated CSV fills unresolved instead of dropping one or counting an API fill twice", () => {
  const result = reconcileCsvActivities(
    history(),
    parse([...csvSeeds, optionRows[0], optionRows[0], optionRows[1]]),
  );
  expect(result.histories[0].records).toHaveLength(5);
  expect(result.histories[0].records[3].importEvidence).toBeUndefined();
  expect(
    buildOptionsLedger(result.histories, "2026-10-31").trades.every(
      (t) => t.status === "needs-review",
    ),
  ).toBe(true);
});
it("does not use the first of multiple conflicting CSV claims for the same execution", () => {
  const result = reconcileCsvActivities(
    history(),
    parse([...csvSeeds, ...optionRows, optionRows[0].replace("SHORT", "LONG")]),
  );
  expect(result.report.conflicts).toBeGreaterThan(0);
  expect(result.histories[0].records[3].optionAction).toBe("unknown");
});
it("rejects cash conflicts without creating a second fill", () => {
  const result = reconcileCsvActivities(
    history(),
    parse([...csvSeeds, optionRows[0].replace(",98,", ",99,")]),
  );
  expect(result.report.conflicts).toBe(1);
  expect(result.histories[0].records).toHaveLength(5);
  expect(result.histories[0].records[3].cashConvention).toBe("unspecified");
});
it("does not map an account from fewer than three corroborating executions", () => {
  const result = reconcileCsvActivities(
    history(seeds.slice(0, 2)),
    parse(csvSeeds),
  );
  expect(result.report.mappedAccounts).toBe(0);
  expect(result.report.added).toBe(0);
});
it("refuses ambiguous source accounts and incomplete API histories", () => {
  const input = history();
  const ambiguous = parse([
    ...csvSeeds,
    ...csvSeeds.map((s) =>
      s.replace("PRIVATE_CSV_ACCOUNT", "ANOTHER_PRIVATE_ACCOUNT"),
    ),
  ]);
  expect(reconcileCsvActivities(input, ambiguous).report.mappedAccounts).toBe(
    0,
  );
  input[0].issues.push("Partial pagination");
  expect(reconcileCsvActivities(input, parse(csvSeeds)).report.matched).toBe(0);
});
it("uses a verified additional assignment stock leg to recover a missing purchase basis", () => {
  const histories = [
    {
      accountId: "sdk-account",
      issues: [],
      transactions: seeds.map((t) =>
        normalizeSecurityTransaction(t, "sdk-account")!,
      ),
    },
  ];
  const csv = parse([
    ...csvSeeds,
    "2026-09-04,PRIVATE_CSV_ACCOUNT,OptionAssign,,SYNTH,USD,10,10,0,-100,LONG",
  ]);
  const account = {
    account: {
      id: "sdk-account",
      name: "Synthetic",
      institution: "Synthetic",
      stale: false,
      incomplete: false,
    },
    positions: {
      status: "ok",
      data: {
        rows: [
          {
            symbol: "SYNTH",
            kind: "stock",
            units: 13,
            value: { amount: 195, currency: "USD" },
          },
        ],
      },
    },
  } as AccountData;
  const merged = reconcileHoldingImport(histories, csv, [account]);
  expect(merged.report.added).toBe(1);
  expect(
    calculateHoldingReturns([account], histories)[0].totalProfit,
  ).toBeNull();
  expect(calculateHoldingReturns([account], merged.histories)[0]).toMatchObject(
    { totalProfit: 65, purchases: 130, issues: [] },
  );
});
it("matches stock assignment rows to existing BUY executions instead of adding duplicates", () => {
  const result = reconcileCsvActivities(
    history(seeds),
    parse([
      ...csvSeeds.slice(0, 2),
      csvSeeds[2].replace(",Trade,BUY,", ",OptionAssign,,"),
    ]),
  );
  expect(result.report.matched).toBe(3);
  expect(result.report.added).toBe(0);
  expect(result.histories[0].records).toHaveLength(3);
});
it("does not add currency-mismatched or unknown-security executions", () => {
  const result = reconcileCsvActivities(
    history(seeds),
    parse([
      ...csvSeeds,
      csvSeeds[0].replace(",USD,", ",CAD,"),
      csvSeeds[2].replace("SYNTH,", "UNKNOWN,"),
    ]),
  );
  expect(result.report.added).toBe(0);
});
it("normalizes observed short-expiry aliases without inventing cash settlement", () => {
  const raw = option("expiry", "SELL", 0, 0, 6);
  const expiry = normalizeTransaction(
    { ...raw, type: "OPTIONS_SHORT_EXPIRY" },
    "sdk-account",
  );
  expect(expiry.type).toBe("OPTIONEXPIRATION");
  expect(expiry.optionAction).toBe("unknown");
});
it("matches an exact settlement date without adding a delayed-booking duplicate", () => {
  const source = history(
    seeds.map((s, i) => ({
      ...s,
      units: i + 1,
      amount: -10 * (i + 1),
      settlement_date: "2026-09-07",
    })),
  );
  const activities = parseWealthsimpleActivity(
    `${header},settlement_date\n${csvSeeds.map((s, i) => s.replace(",USD,1,10,0,-10,", `,USD,${i + 1},10,0,${-10 * (i + 1)},`)).join(",2026-09-07\n")},2026-09-07`,
  ).activities;
  activities[2].activity.date = "2026-09-05";
  expect(reconcileCsvActivities(source, activities).report).toMatchObject({
    matched: 3,
    added: 0,
  });
});
it("holds additional stock rows when no independent ending-share snapshot is available", () => {
  const histories = [
    {
      accountId: "sdk-account",
      issues: [],
      transactions: seeds.map((t) =>
        normalizeSecurityTransaction(t, "sdk-account")!,
      ),
    },
  ];
  const result = reconcileHoldingImport(
    histories,
    parse([
      ...csvSeeds,
      "2026-09-10,PRIVATE_CSV_ACCOUNT,Trade,BUY,SYNTH,USD,10,10,0,-100,LONG",
    ]),
  );
  expect(result.report).toMatchObject({ added: 0, pendingAdditional: 1 });
  expect(result.histories[0].transactions).toHaveLength(3);
});
it("preserves zero API transfer cash and uses only signed source quantity, never CSV transfer valuation as cost", () => {
  const source = history(seeds);
  source[0].records.push(
    normalizeTransaction(
      {
        ...stock(4),
        id: "transfer",
        type: "TRANSFER",
        amount: 0,
        price: 0,
        units: 10,
      },
      "sdk-account",
    ),
  );
  const result = reconcileCsvActivities(
    source,
    parse([
      ...csvSeeds,
      "2026-09-04,PRIVATE_CSV_ACCOUNT,Transfer,TRANSFER,SYNTH,CAD,-10,,,150,LONG",
    ]),
  );
  const transfer = result.histories[0].records.at(-1)!;
  expect(transfer.importEvidence?.transferDirection).toBe("out");
  expect(transfer.cashFlow.amount.value).toBe("0");
  expect(transfer.cashConvention).toBe("unspecified");
});

it("does not invent an exchange-qualified security for an ambiguous raw ticker", () => {
  const source = history(seeds);
  source.push({
    accountId: "another-sdk",
    issues: [],
    records: [
      normalizeTransaction(
        {
          ...stock(1),
          id: "canadian-reference",
          symbol: {
            symbol: "SYNTH.TO",
            raw_symbol: "SYNTH",
            type: { code: "cs" },
            currency: { code: "CAD" },
          },
          currency: { code: "CAD" },
        },
        "another-sdk",
      ),
    ],
  });
  const result = reconcileCsvActivities(
    source,
    parse([
      ...csvSeeds,
      "2026-09-10,PRIVATE_CSV_ACCOUNT,Trade,BUY,SYNTH,USD,10,10,0,-100,LONG",
    ]),
  );
  expect(result.report.added).toBe(0);
});
