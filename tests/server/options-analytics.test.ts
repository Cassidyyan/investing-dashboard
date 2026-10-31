import { expect, it, vi } from "vitest";
import { loadOptionsAnalytics } from "@/server/load-options-analytics";
import type { ReadClient } from "@/server/snaptrade";
function client() {
  return {
    accounts: vi.fn(async () => ({
      data: [
        { id: "a", name: "Synthetic A", account_category: "INVESTMENT" },
        { id: "b", name: "Synthetic B", account_category: "INVESTMENT" },
      ],
    })),
    connections: vi.fn(async () => ({ data: [] })),
    positions: vi.fn(async () => ({ data: { results: [] } })),
    transactionPage: vi.fn(async (id: string) => ({
      data: {
        data: [
          {
            id: `${id}-open`,
            type: "BUY",
            option_type: "BUY_TO_OPEN",
            units: 1,
            price: 1,
            amount: -100,
            fee: 0,
            currency: { code: "USD" },
            trade_date: "2026-10-01T14:00:00Z",
            option_symbol: {
              ticker: "SYNTH261218P00100000",
              option_type: "PUT",
              strike_price: 100,
              expiration_date: "2026-12-18",
              underlying_symbol: { symbol: "SYNTH" },
            },
          },
          {
            id: `${id}-close`,
            type: "SELL",
            option_type: "SELL_TO_CLOSE",
            units: 1,
            price: 1.5,
            amount: 150,
            fee: 0,
            currency: { code: "USD" },
            trade_date: "2026-10-02T14:00:00Z",
            option_symbol: {
              ticker: "SYNTH261218P00100000",
              option_type: "PUT",
              strike_price: 100,
              expiration_date: "2026-12-18",
              underlying_symbol: { symbol: "SYNTH" },
            },
          },
        ],
        pagination: { total: 2 },
      },
    })),
    orders: vi.fn(),
    balances: vi.fn(),
    activities: vi.fn(),
  };
}
it("loads paginated activities and current positions without requesting order snapshots", async () => {
  const c = client();
  const data = await loadOptionsAnalytics(c as unknown as ReadClient);
  expect(data.trades.map((t) => t.realizedPnl)).toEqual(["50", "50"]);
  expect(c.orders).not.toHaveBeenCalled();
  expect(c.activities).not.toHaveBeenCalled();
  expect(c.balances).not.toHaveBeenCalled();
  expect(c.transactionPage).toHaveBeenCalledWith("a", 0, 1000);
});
it("preserves the successful account when another history request fails, redacting upstream text", async () => {
  const c = client();
  c.transactionPage.mockRejectedValueOnce(
    new Error("PRIVATE upstream details"),
  );
  const data = await loadOptionsAnalytics(c as unknown as ReadClient);
  expect(data.trades).toHaveLength(1);
  expect(data.trades[0].realizedPnl).toBe("50");
  expect(data.issues.some((i) => i.accountId === "a")).toBe(true);
  expect(JSON.stringify(data)).not.toContain("PRIVATE");
});
it("stops subsequent account histories after a rate limit", async () => {
  const c = client();
  c.transactionPage.mockRejectedValueOnce({ response: { status: 429 } });
  const data = await loadOptionsAnalytics(c as unknown as ReadClient);
  expect(c.transactionPage).toHaveBeenCalledTimes(1);
  expect(data.issues).toHaveLength(2);
  expect(data.trades).toEqual([]);
});
it("shows setup without attempting real requests when unconfigured", async () => {
  const data = await loadOptionsAnalytics(null);
  expect(data.configured).toBe(false);
  expect(data.error).toContain("Configure");
  expect(data.trades).toEqual([]);
});
it("uses transaction synchronization rather than unrelated stale holdings to gate old trade evidence", async () => {
  const c = client();
  c.accounts.mockImplementation(async () => ({
    data: [
      {
        id: "a",
        name: "Synthetic A",
        account_category: "INVESTMENT",
        sync_status: {
          holdings: { last_successful_sync: "2000-01-01" },
          transactions: { initial_sync_completed: true },
        },
      },
    ],
  }));
  const data = await loadOptionsAnalytics(c as unknown as ReadClient);
  expect(data.trades[0].realizedPnl).toBe("50");
  expect(data.historyCoverage?.[0].sync?.initialSyncCompleted).toBe(true);
  const other = client();
  other.accounts.mockImplementation(async () => ({
    data: [
      {
        id: "a",
        name: "Synthetic A",
        account_category: "INVESTMENT",
        sync_status: { transactions: { initial_sync_completed: false } },
      },
    ],
  }));
  const incomplete = await loadOptionsAnalytics(other as unknown as ReadClient);
  expect(incomplete.trades[0].realizedPnl).toBeNull();
});
