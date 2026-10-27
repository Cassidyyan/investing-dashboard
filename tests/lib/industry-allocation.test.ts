import { expect, it } from "vitest";
import { industryAllocation } from "@/lib/industry-allocation";
import { securityIndustry } from "@/lib/security-industries";
import type {
  AccountData,
  PositionView,
  Result,
  ExchangeRate,
} from "@/lib/types";
const rate: Result<ExchangeRate> = {
  status: "ok",
  data: { cadPerUsd: 1.5, asOf: "2026-10-26" },
};
function position(
  symbol: string,
  amount: number | null,
  currency: string | null,
  kind = "stock",
): PositionView {
  return {
    symbol,
    kind,
    description: "",
    units: 1,
    price: { amount, currency },
    value: { amount, currency },
  };
}
function account(rows: PositionView[]): AccountData {
  return {
    account: {
      id: "a",
      name: "Test",
      suffix: "1234",
      institution: "Test",
      type: "Test",
      value: { amount: null, currency: null },
      syncedAt: null,
      stale: false,
      incomplete: false,
    },
    positions: { status: "ok", data: { rows, asOf: null } },
    balances: { status: "ok", data: [] },
    orders: { status: "ok", data: [] },
    activities: { status: "ok", data: { rows: [], total: 0 } },
  };
}
it("aggregates industries across accounts after converting CAD into USD", () => {
  const result = industryAllocation(
    [
      account([position("NVDA", 100, "USD"), position("BAM.TO", 150, "CAD")]),
      account([
        position("NVDA", 50, "USD"),
        position("TSM", 150, "USD", "adr"),
        position("BAM", 50, "USD"),
      ]),
    ],
    rate,
  );
  if (result.status !== "ok") throw Error("Expected result");
  expect(result.data.total).toBe(450);
  const semis = result.data.groups.find((g) => g.label === "Semiconductors")!;
  expect(semis.amount).toBe(300);
  expect(semis.holdings).toHaveLength(2);
  expect(semis.holdings.find((h) => h.symbol === "NVDA")?.amount).toBe(150);
  expect(
    result.data.groups.find((g) => g.label === "Asset management")?.amount,
  ).toBe(150);
  expect(result.data.groups.reduce((sum, g) => sum + g.percent, 0)).toBeCloseTo(
    100,
  );
});
it("keeps funds separate rather than assigning an issuer's industry or estimating look-through exposure", () => {
  const result = industryAllocation(
    [
      account([
        position("VFV.TO", 150, "CAD", "etf"),
        position("URA", 50, "USD", "etf"),
        position("PHYS.TO", 150, "CAD", "other"),
      ]),
    ],
    rate,
  );
  if (result.status !== "ok") throw Error();
  expect(result.data.groups.map((g) => g.label)).toEqual(
    expect.arrayContaining([
      "Diversified equity funds",
      "Sector funds (no look-through)",
      "Precious-metals trusts",
    ]),
  );
  expect(result.data.total).toBe(250);
});
it("keeps unknown listings in the allocation and reports them as unclassified", () => {
  const result = industryAllocation(
    [account([position("NEW", 40, "USD"), position("NVDA.TO", 60, "CAD")])],
    rate,
  );
  if (result.status !== "ok") throw Error();
  expect(result.data.unclassified).toEqual(["NEW", "NVDA.TO"]);
  expect(result.data.groups[0].label).toBe("Unclassified");
  expect(result.data.total).toBe(80);
  expect(securityIndustry("toString", "stock").industry).toBe("Unclassified");
});
it("excludes options, cash equivalents, crypto, shorts, missing values, and unsupported currencies", () => {
  const cash = position("CASH", 100, "USD");
  cash.cashEquivalent = true;
  const result = industryAllocation(
    [
      account([
        position("NVDA", 10, "USD"),
        position("OPT", 100, "USD", "option"),
        position("BTC", 100, "USD", "crypto"),
        cash,
        position("SHORT", -10, "USD"),
        position("NO_PRICE", null, "USD"),
        position("EUR_STOCK", 30, "EUR"),
      ]),
    ],
    rate,
  );
  if (result.status !== "ok") throw Error();
  expect(result.data.total).toBe(10);
  expect(result.data.excluded).toBe(3);
});
it("does not silently omit CAD positions when the conversion feed fails", () => {
  const missing: Result<ExchangeRate> = {
    status: "error",
    message: "Unavailable",
  };
  expect(
    industryAllocation([account([position("BAM.TO", 100, "CAD")])], missing)
      .status,
  ).toBe("error");
  const usd = industryAllocation(
    [account([position("NVDA", 100, "USD")])],
    missing,
  );
  expect(usd.status).toBe("ok");
  expect(
    industryAllocation([account([position("BAM.TO", 100, "CAD")])], {
      status: "ok",
      data: { cadPerUsd: 0, asOf: "2026-10-26" },
    }).status,
  ).toBe("error");
});
it("retains available accounts while flagging failures and stale snapshots", () => {
  const failed = account([]);
  failed.positions = { status: "error", message: "Unavailable" };
  const stale = account([position("NVDA", 100, "USD")]);
  stale.account.stale = true;
  const result = industryAllocation([failed, stale], rate);
  if (result.status !== "ok") throw Error();
  expect(result.data.failedAccounts).toBe(1);
  expect(result.data.stale).toBe(true);
  expect(result.data.total).toBe(100);
});
