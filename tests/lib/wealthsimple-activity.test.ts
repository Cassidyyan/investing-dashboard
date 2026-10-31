import { expect, it } from "vitest";
import {
  parseCsv,
  parseWealthsimpleActivity,
} from "@/lib/imports/wealthsimple-activity";

const header =
  "effective_date,account_id,activity_type,activity_sub_type,symbol,currency,quantity,unit_price,commission,net_cash_amount";
const record =
  "2026-10-01,SYNTHETIC_ACCOUNT,Trade,BUY,SYNTH261218C00100000,USD,1,1,0,-100";
it("parses BOM, CRLF, quoted commas/newlines and escaped quotes without shifting fields", () => {
  expect(parseCsv('\uFEFFa,b\r\n"one,two","a\n""quote"""\r\n')).toEqual([
    ["a", "b"],
    ["one,two", 'a\n"quote"'],
  ]);
});
it.each(['a,b\n"unfinished', 'a,b\n"a"junk,b', 'a,b\nhel"lo,b', "a,\0"])(
  "rejects malformed CSV (%s)",
  (text) => {
    expect(() => parseCsv(text)).toThrow();
  },
);
it("validates headers and refuses duplicate fields and unrelated report types", () => {
  expect(() =>
    parseWealthsimpleActivity("account_id,account_id\na,a"),
  ).toThrow();
  expect(() =>
    parseWealthsimpleActivity("symbol,realized_gain\nSYNTH,100"),
  ).toThrow();
});
it("retains exact reported net cash and commission without inventing direction or multiplier", () => {
  const result = parseWealthsimpleActivity(`${header}\n${record}\n`);
  expect(result).toMatchObject({
    records: 1,
    earliest: "2026-10-01",
    latest: "2026-10-01",
    rejected: 0,
  });
  expect(result.rows[0].activity).toMatchObject({
    symbol: "SYNTH261218C00100000",
    action: "BUY",
    explicitAction: false,
    quantity: "1",
    netCash: "-100",
    commission: "0",
    issues: ["Opening/closing direction is not supplied."],
  });
  expect(result.rows[0].activity).not.toHaveProperty("multiplier");
});
it("keeps explicit actions and invalid numeric/date fields visible, rather than substituting zero", () => {
  const text = `${header}\n${record.replace("2026-10-01", "2026-02-30").replace(",BUY,", ",BUY_TO_OPEN,").replace(",1,1,0,-100", ",,1,,-100")}`;
  const r = parseWealthsimpleActivity(text).rows[0].activity;
  expect(r).toMatchObject({
    date: null,
    quantity: null,
    commission: null,
    netCash: "-100",
    explicitAction: true,
  });
  expect(r.issues.length).toBe(2);
});
it("counts non-option activity but keeps it out of the options preview and rejects misaligned rows", () => {
  const result = parseWealthsimpleActivity(
    `${header}\n${record}\n${record.replace("SYNTH261218C00100000", "SYNTH")}\nmissing,columns`,
  );
  expect(result.records).toBe(3);
  expect(result.rows).toHaveLength(1);
  expect(result.rejected).toBe(1);
});

it.each([
  ["BUY", "LONG", "BUY_TO_OPEN"],
  ["SELL", "LONG", "SELL_TO_CLOSE"],
  ["SELL", "SHORT", "SELL_TO_OPEN"],
  ["BUY", "SHORT", "BUY_TO_CLOSE"],
])(
  "preserves source side and labels %s/%s as an unverified candidate",
  (action, side, candidate) => {
    const result = parseWealthsimpleActivity(
      `${header},direction\n${record.replace(",BUY,", `,${action},`)},${side}`,
    );
    expect(result.rows[0].activity).toMatchObject({
      action,
      side,
      candidateAction: candidate,
      explicitAction: false,
    });
  },
);
