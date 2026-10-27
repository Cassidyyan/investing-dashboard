import { expect, it, vi } from "vitest";
import {
  loadPerformance,
  normalizeHistory,
  normalizeReturns,
} from "@/server/load-performance";
import type { AccountData } from "@/lib/types";
import type { ReadClient } from "@/server/snaptrade";
it("sorts history, preserves zero/negative values, and flags invalid snapshots", () => {
  expect(
    normalizeHistory({
      currency: "CAD",
      history: [
        { date: "2026-10-26T00:00:00Z", total_value: "0" },
        { date: "bad", total_value: "12" },
        { date: "2026-10-23", total_value: "-10" },
        { date: "2026-10-24", total_value: "NaN" },
      ],
    }),
  ).toEqual({
    currency: "CAD",
    points: [
      { date: "2026-10-23", value: -10 },
      { date: "2026-10-26", value: 0 },
    ],
    omittedPoints: 2,
  });
  expect(() => normalizeHistory({ history: [] })).toThrow();
});
it("preserves broker percent units and does not substitute other timeframes", () => {
  expect(
    normalizeReturns({
      data: [
        { timeframe: "1M", return_percent: 5.97, created_date: "2026-10-26" },
        { timeframe: "1D", return_percent: 0 },
      ],
    }),
  ).toEqual([
    { timeframe: "1M", percent: 5.97, asOf: "2026-10-26" },
    { timeframe: "1D", percent: 0, asOf: null },
  ]);
});
it("keeps reported returns when history is disabled, with no upstream error leakage", async () => {
  const client = {
    history: vi.fn().mockRejectedValue({
      response: { status: 403, data: { secret: "PRIVATE" } },
    }),
    returns: vi.fn().mockResolvedValue({
      data: { data: [{ timeframe: "1M", return_percent: 3 }] },
    }),
  };
  const accounts = [
    { account: { id: "a", name: "Test", suffix: "1234" } },
  ] as AccountData[];
  const result = await loadPerformance(
    accounts,
    client as unknown as Pick<ReadClient, "history" | "returns">,
  );
  expect(result[0].history.status).toBe("error");
  expect(result[0].returns.status).toBe("ok");
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(JSON.stringify(result)).toContain("add-on");
  expect(client.history).toHaveBeenCalledTimes(1);
  expect(client.returns).toHaveBeenCalledTimes(1);
});
it("retains account history when return requests hit a rate limit", async () => {
  const client = {
    history: vi.fn().mockResolvedValue({
      data: {
        currency: "USD",
        history: [{ date: "2026-10-26", total_value: "50" }],
      },
    }),
    returns: vi.fn().mockRejectedValue({ response: { status: 429 } }),
  };
  const result = await loadPerformance(
    [{ account: { id: "a", name: "Test", suffix: "1234" } }] as AccountData[],
    client as unknown as Pick<ReadClient, "history" | "returns">,
  );
  expect(result[0].history.status).toBe("ok");
  expect(result[0].returns.status).toBe("error");
  expect(JSON.stringify(result)).toContain("rate limit");
});
