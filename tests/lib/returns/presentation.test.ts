import { expect, it } from "vitest";
import { createReturnsPreview } from "@/dev/previews/returns-preview";
import {
  groupedReasons,
  isRanked,
  sortReturns,
  sumReturns,
} from "@/lib/returns/presentation";
import { signedAmount } from "@/lib/format";
it("sums ranked native components without adding unranked dividends and preserves charges", () => {
  const rows = createReturnsPreview().rows.filter(
    (r) => r.currency === "CAD" && isRanked(r),
  );
  expect(sumReturns(rows, "totalProfit")).toBe(3600);
  expect(sumReturns(rows, "realized")).toBe(2160);
  expect(sumReturns(rows, "unrealized")).toBe(1200);
  expect(sumReturns(rows, "dividends")).toBe(360);
  expect(sumReturns(rows, "charges")).toBe(120);
  expect(sumReturns([], "totalProfit")).toBeNull();
});
it("sorts all source rows without mutation and places missing components last", () => {
  const rows = createReturnsPreview().rows.filter(isRanked),
    before = rows.map((r) => r.key);
  const sorted = sortReturns(rows, "profit-asc");
  expect(sorted[0].totalProfit).toBe(-560);
  expect(sortReturns(rows, "profit-desc")[0].totalProfit).toBe(1200);
  expect(rows.map((r) => r.key)).toEqual(before);
  const missing = { ...rows[0], key: "missing", realized: null };
  expect(sortReturns([missing, ...rows], "realized").at(-1)?.key).toBe(
    "missing",
  );
});
it("groups actual reasons without duplicating repeated issues", () => {
  const row = createReturnsPreview("unranked").rows[0];
  row.issues = [
    "No complete purchase basis is available.",
    "No complete purchase basis is available.",
    "Missing historical FX rate.",
  ];
  expect(groupedReasons(row)).toEqual([
    {
      label: "No purchase basis",
      issues: ["No complete purchase basis is available."],
    },
    { label: "FX / currency", issues: ["Missing historical FX rate."] },
  ]);
});
it("removes only currency display and retains sign and precision", () => {
  expect(signedAmount({ amount: 1234.5, currency: "CAD" })).toBe("+1,234.50");
  expect(signedAmount({ amount: -12.3, currency: "USD" })).toBe("-12.30");
  expect(signedAmount({ amount: null, currency: "CAD" })).toBe("Unavailable");
});

it("does not label a missing opening purchase as a confirmed short sale", async () => {
  const { reasonCategory, recoveryAction } =
    await import("@/lib/returns/presentation");
  expect(
    reasonCategory(
      "A sale has no matching purchase history or is a short sale.",
    ),
  ).toBe("No purchase basis");
  expect(
    reasonCategory("Current holdings are incomplete, stale, or unavailable."),
  ).toBe("Snapshot freshness");
  expect(recoveryAction("No purchase basis")).toContain(
    "not proof of a short sale",
  );
  expect(recoveryAction("Transfer reconciliation")).toContain(
    "original purchases",
  );
});
