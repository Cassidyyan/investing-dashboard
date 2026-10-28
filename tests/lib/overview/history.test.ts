import { expect, it } from "vitest";
import { connectOverviewHistory } from "@/lib/overview/history";
import { adaptOverview } from "@/lib/overview/overview";
import { createPerformancePreview } from "@/dev/previews/performance-preview";
import { createAccountsPreview } from "@/dev/previews/accounts-preview";
import type { PerformanceAccount } from "@/lib/types";
function fixture() {
  const sample = createPerformancePreview();
  const model = adaptOverview(sample.portfolio, {
    status: "ok",
    data: { cadPerUsd: 2, asOf: "2026-10-11" },
  });
  return { ...sample, model };
}
it("connects real-shaped history, per-account daily changes and funding gains without replacing reported totals", () => {
  const { model, history, today } = fixture();
  const result = connectOverviewHistory(model, history, today);
  expect(result.accounts[0].value).toEqual(model.accounts[0].value);
  expect(result.accounts[0].dayChange).toEqual({
    amount: 150,
    percent: (150 / 2050) * 100,
  });
  expect(result.historyByCurrency?.CAD?.gain).toEqual({
    amount: 200,
    percent: 10,
  });
  expect(result.historyByCurrency?.CAD?.ranges["1D"]).toEqual([
    { label: "2026-10-06", value: 2050 },
    { label: "2026-10-11", value: 2200 },
  ]);
  expect(result.historyByCurrency?.CAD?.ranges.All).toHaveLength(3);
  expect(result.historyByCurrency?.CAD?.period).toBe("2026-10-06 → 2026-10-11");
  expect(result.mock).toBe(false);
});
it("keeps historical currency groups separate and never converts historical values at the current FX rate", () => {
  const { model, history, today } = fixture();
  model.accounts.push({ ...model.accounts[0], id: "usd", name: "USD account" });
  history.push({
    ...history[0],
    id: "usd",
    history: {
      status: "ok",
      data: {
        currency: "USD",
        omittedPoints: 0,
        points: [{ date: "2026-10-11", value: 100 }],
      },
    },
  });
  const result = connectOverviewHistory(model, history, today);
  expect(result.historyByCurrency?.CAD?.ranges.All.at(-1)?.value).toBe(2200);
  expect(result.historyByCurrency?.USD?.ranges.All.at(-1)?.value).toBe(100);
  expect(result.historyByCurrency?.CAD?.accountCount).toBe(1);
  expect(result.historyByCurrency?.CAD?.totalAccounts).toBe(2);
});
it("retains available history when funding fails and reports its exact safe reason", () => {
  const { model, history, today } = fixture();
  history[0].funding = { status: "error", message: "Funding incomplete" };
  const result = connectOverviewHistory(model, history, today);
  expect(result.historyByCurrency?.CAD?.ranges.All).toHaveLength(3);
  expect(result.historyByCurrency?.CAD?.gain).toBeNull();
  expect(result.historyByCurrency?.CAD?.gainMessage).toBe("Funding incomplete");
});
it("shows partial coverage for failed or empty histories without letting an empty account erase good snapshots", () => {
  const { model, history, today } = fixture();
  model.accounts.push(
    { ...model.accounts[0], id: "empty" },
    { ...model.accounts[0], id: "failed" },
  );
  history.push(
    {
      ...history[0],
      id: "empty",
      history: {
        status: "ok",
        data: { currency: "CAD", points: [], omittedPoints: 0 },
      },
    },
    {
      ...history[0],
      id: "failed",
      history: { status: "error", message: "History access denied" },
    },
  );
  const result = connectOverviewHistory(model, history, today);
  expect(result.historyByCurrency?.CAD?.ranges.All).toHaveLength(3);
  expect(result.historyByCurrency?.CAD?.accountCount).toBe(1);
  expect(result.historyByCurrency?.CAD?.totalAccounts).toBe(3);
  expect(result.historyMessage).toContain("2 account histories");
  expect(result.historyIssues).toContain("History access denied");
});
it("requires shared dates and excludes future points without filling missing values", () => {
  const { model, history, today } = fixture();
  model.accounts.push({ ...model.accounts[0], id: "second" });
  const second: PerformanceAccount = {
    ...history[0],
    id: "second",
    history: {
      status: "ok",
      data: {
        currency: "CAD",
        omittedPoints: 0,
        points: [
          { date: "2026-10-11", value: 100 },
          { date: "2026-10-30", value: 999999 },
        ],
      },
    },
  };
  const result = connectOverviewHistory(model, [...history, second], today);
  expect(result.historyByCurrency?.CAD?.ranges.All).toEqual([
    { label: "2026-10-11", value: 2300 },
  ]);
  expect(result.historyByCurrency?.CAD?.dayChange).toBeNull();
  expect(result.historyByCurrency?.CAD?.missingDates).toBeGreaterThan(0);
});
it("connects the newest dated activities while disclosing failed requests and missing dates", () => {
  const { portfolio } = createAccountsPreview("sample");
  if (portfolio.accounts.status !== "ok") throw Error("fixture");
  portfolio.accounts.data[0].activities = {
    status: "ok",
    data: {
      rows: [
        {
          date: "2026-10-09",
          description: "Recorded purchase",
          type: "BUY",
          amount: { amount: -100, currency: "CAD" },
        },
        {
          date: "2026-10-10",
          description: "Recorded dividend",
          type: "DIVIDEND",
          amount: { amount: 5, currency: "USD" },
        },
        {
          date: null,
          description: "Undated",
          type: "UNKNOWN",
          amount: { amount: null, currency: null },
        },
      ],
      total: 3,
    },
  };
  portfolio.accounts.data[1].activities = {
    status: "error",
    message: "Unavailable",
  };
  const model = adaptOverview(
    portfolio,
    { status: "error", message: "No FX" },
    { activitiesLoaded: true },
  );
  expect(model.activity?.map((a) => a.label)).toEqual([
    "Recorded dividend",
    "Recorded purchase",
  ]);
  expect(model.activity?.[0].value.currency).toBe("USD");
  expect(model.activityMessage).toContain("partial");
});
