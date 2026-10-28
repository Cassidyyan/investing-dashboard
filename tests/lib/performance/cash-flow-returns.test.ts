import { expect, it } from "vitest";
import {
  cashFlowReturns,
  aggregateFunding,
} from "@/lib/performance/cash-flow-returns";
import type { AccountFunding, PerformanceAccount, Result } from "@/lib/types";
const start = { date: "2026-01-01", value: 1000 };
const end = { date: "2026-01-11", value: 2200 };
const funding: Result<AccountFunding> = {
  status: "ok",
  data: {
    events: [
      { date: "2025-12-01", amount: 1000, currency: "CAD" },
      { date: "2026-01-06", amount: 1000, currency: "CAD" },
      { date: "2026-01-12", amount: 99999, currency: "CAD" },
    ],
  },
};
it("uses deposits only through the inspected date and time-weights deposits within the range", () => {
  const result = cashFlowReturns(start, end, "CAD", funding);
  expect(result.netDeposits).toBe(2000);
  expect(result.netGain.percent).toBeCloseTo(10);
  expect(result.period.percent).toBeCloseTo((200 / 1500) * 100);
});
it("does not count a pure deposit as investment gain", () => {
  const result = cashFlowReturns(
    start,
    { ...end, value: 2000 },
    "CAD",
    funding,
  );
  expect(result.netGain.percent).toBe(0);
  expect(result.period.percent).toBe(0);
});
it("subtracts withdrawals and weights them by the remaining holding time", () => {
  const result = cashFlowReturns(start, { ...end, value: 600 }, "CAD", {
    status: "ok",
    data: {
      events: [
        { date: "2025-12-01", amount: 1000, currency: "CAD" },
        { date: "2026-01-06", amount: -500, currency: "CAD" },
      ],
    },
  });
  expect(result.netDeposits).toBe(500);
  expect(result.netGain.percent).toBe(20);
  expect(result.period.percent).toBeCloseTo((100 / 750) * 100);
});
it("keeps lifetime funding independent of date-range changes and excludes baseline-day flows from period cash flows", () => {
  const laterStart = { date: "2026-01-06", value: 2100 };
  const result = cashFlowReturns(laterStart, end, "CAD", funding);
  expect(result.netDeposits).toBe(2000);
  expect(result.netGain.percent).toBe(10);
  expect(result.period.percent).toBeCloseTo((100 / 2100) * 100);
});
it("includes final-day deposits in net flows with zero end-of-day time weight", () => {
  const result = cashFlowReturns(start, { ...end, value: 2100 }, "CAD", {
    status: "ok",
    data: { events: [{ date: end.date, amount: 1000, currency: "CAD" }] },
  });
  expect(result.period.percent).toBe(10);
});
it("returns unavailable for missing funding, unsupported currencies and undated events", () => {
  const failed = cashFlowReturns(start, end, "CAD", {
    status: "error",
    message: "Incomplete pagination",
  });
  expect(failed.netGain.percent).toBeNull();
  expect(failed.period.reason).toBe("Incomplete pagination");
  for (const event of [
    { date: "2026-01-05", amount: 50, currency: "USD" },
    { date: null, amount: 50, currency: "CAD" },
    { date: "2026-01-05", amount: null, currency: "CAD" },
  ]) {
    const result = cashFlowReturns(start, end, "CAD", {
      status: "ok",
      data: { events: [event] },
    });
    expect(result.netGain.percent).toBeNull();
    expect(result.period.percent).toBeNull();
  }
});
it("does not let unsupported future transfers contaminate an earlier snapshot; older issues block lifetime but not later ranges", () => {
  const events = [
    {
      date: "2026-01-12",
      amount: null,
      currency: "CAD",
      issue: "Transfer unresolved",
    },
    {
      date: "2025-12-01",
      amount: null,
      currency: "CAD",
      issue: "Older transfer unresolved",
    },
  ];
  const result = cashFlowReturns(start, end, "CAD", {
    status: "ok",
    data: { events },
  });
  expect(result.netGain.reason).toBe("Older transfer unresolved");
  expect(result.period.percent).toBe(120);
});
it("avoids invalid zero/negative denominators and the first point has no period return", () => {
  const empty: Result<AccountFunding> = { status: "ok", data: { events: [] } };
  expect(cashFlowReturns(start, start, "CAD", empty).period.percent).toBeNull();
  expect(cashFlowReturns(start, end, "CAD", empty).netGain.percent).toBeNull();
  expect(
    cashFlowReturns({ ...start, value: 0 }, end, "CAD", empty).period.percent,
  ).toBeNull();
  expect(
    cashFlowReturns(start, { ...end, value: Infinity }, "CAD", funding).netGain
      .percent,
  ).toBeNull();
});
it("combines same-currency funding from exactly the accounts included in history, never averages account returns", () => {
  function account(
    id: string,
    currency: string,
    amount: number,
  ): PerformanceAccount {
    return {
      id,
      name: id,
      suffix: "1234",
      returns: { status: "ok", data: [] },
      history: {
        status: "ok",
        data: { currency, points: [start], omittedPoints: 0 },
      },
      funding: {
        status: "ok",
        data: { events: [{ date: "2025-12-01", amount, currency }] },
      },
    };
  }
  const accounts = [
    account("a", "CAD", 1000),
    account("b", "CAD", 2000),
    account("c", "USD", 9000),
  ];
  const result = cashFlowReturns(
    { ...start, value: 3000 },
    { ...end, value: 3300 },
    "CAD",
    aggregateFunding(accounts, "CAD"),
  );
  expect(result.netDeposits).toBe(3000);
  expect(result.netGain.percent).toBe(10);
  accounts[1].funding = { status: "error", message: "Unavailable account" };
  expect(aggregateFunding(accounts, "CAD").status).toBe("error");
});
