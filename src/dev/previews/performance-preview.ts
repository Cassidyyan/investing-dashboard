// Invented data for tests and explicitly labelled development previews only.
import type { PerformanceAccount } from "@/lib/types";
import { createAccountsPreview } from "./accounts-preview";
export function createPerformancePreview(state: string = "sample") {
  const { portfolio } = createAccountsPreview("sample");
  if (portfolio.accounts.status !== "ok")
    throw Error("Preview fixture unavailable");
  portfolio.accounts.data = portfolio.accounts.data.slice(0, 1);
  const account = portfolio.accounts.data[0].account;
  const history: PerformanceAccount[] = [
    {
      id: account.id,
      name: account.name,
      suffix: account.suffix,
      history: {
        status: "ok",
        data: {
          currency: "CAD",
          omittedPoints: 0,
          points: [
            { date: "2026-10-01", value: 1000 },
            { date: "2026-10-06", value: 2050 },
            { date: "2026-10-11", value: 2200 },
          ],
        },
      },
      returns: { status: "ok", data: [] },
      funding: {
        status: "ok",
        data: {
          events: [
            { date: "2026-09-01", amount: 1000, currency: "CAD" },
            { date: "2026-10-06", amount: 1000, currency: "CAD" },
            { date: "2026-10-12", amount: 90000, currency: "CAD" },
          ],
        },
      },
    },
  ];
  if (state === "empty") {
    history.length = 0;
    portfolio.accounts = { status: "ok", data: [] };
  }
  if (state === "single" && history[0].history.status === "ok")
    history[0].history.data.points = history[0].history.data.points.slice(-1);
  if (state === "error") {
    history[0].history = {
      status: "error",
      message: "Sample history access unavailable",
    };
    portfolio.connections = {
      status: "ok",
      data: [{ name: "Sample brokerage", status: "Disabled" }],
    };
  }
  if (state === "mixed")
    history.push({
      ...history[0],
      id: "sample-usd",
      name: "Sample USD account",
      history: {
        status: "ok",
        data: {
          currency: "USD",
          omittedPoints: 0,
          points: [
            { date: "2026-10-01", value: 500 },
            { date: "2026-10-11", value: 550 },
          ],
        },
      },
    });
  if (state === "reported")
    history[0].returns = {
      status: "ok",
      data: [
        { timeframe: "1D", percent: 1.2, asOf: "2026-10-11" },
        { timeframe: "1M", percent: 4.2, asOf: "2026-10-11" },
      ],
    };
  return { portfolio, history, today: "2026-10-11" };
}
