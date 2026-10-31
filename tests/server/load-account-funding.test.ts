import { expect, it, vi } from "vitest";
import {
  loadAccountFunding,
  normalizeFundingEvent,
} from "@/server/load-account-funding";
import type { ReadClient } from "@/server/snaptrade";
const deposit = {
  id: "deposit",
  type: "CONTRIBUTION",
  trade_date: "2026-01-01",
  amount: 100,
  currency: { code: "CAD" },
};
it("separates external funding from trades, dividends, interest and fees", () => {
  expect(normalizeFundingEvent(deposit)).toEqual({
    date: "2026-01-01",
    amount: 100,
    currency: "CAD",
  });
  expect(
    normalizeFundingEvent({ ...deposit, type: "WITHDRAWAL", amount: -20 })
      ?.amount,
  ).toBe(-20);
  for (const type of [
    "BUY",
    "SELL",
    "DIVIDEND",
    "INTEREST",
    "FEE",
    "TAX",
    "REI",
  ])
    expect(normalizeFundingEvent({ ...deposit, type })).toBeNull();
});
it("marks transfers, missing details, incorrect signs and in-kind contributions for reconciliation", () => {
  for (const record of [
    { ...deposit, type: "TRANSFER" },
    { ...deposit, type: "UNKNOWN" },
    { ...deposit, amount: null },
    { ...deposit, trade_date: "bad" },
    { ...deposit, amount: -50 },
    { ...deposit, type: "WITHDRAWAL", amount: 20 },
    { ...deposit, symbol: { symbol: "TEST" } },
    { ...deposit, fee: 5 },
  ])
    expect(normalizeFundingEvent(record)?.issue).toBeTruthy();
});
it("reads all available pages and retains only funding-relevant events", async () => {
  const transactionPage = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        data: Array.from({ length: 1000 }, (_, i) => ({
          ...deposit,
          id: String(i),
        })),
        pagination: { total: 1001 },
      },
    })
    .mockResolvedValueOnce({
      data: {
        data: [{ ...deposit, id: "last", type: "DIVIDEND" }],
        pagination: { total: 1001 },
      },
    });
  const result = await loadAccountFunding("account", {
    transactionPage,
  } as unknown as Pick<ReadClient, "transactionPage">);
  expect(result.status === "ok" && result.data.events.length).toBe(1000);
  expect(transactionPage).toHaveBeenNthCalledWith(2, "account", 1000, 1000);
});
it("rejects conflicting IDs, missing IDs and truncated pages rather than using incomplete funding", async () => {
  for (const data of [
    { data: [deposit, { ...deposit, amount: 200 }], pagination: { total: 2 } },
    { data: [{ ...deposit, id: undefined }], pagination: { total: 1 } },
    { data: [deposit], pagination: { total: 100 } },
  ]) {
    const result = await loadAccountFunding("a", {
      transactionPage: vi.fn().mockResolvedValue({ data }),
    } as unknown as Pick<ReadClient, "transactionPage">);
    expect(result.status).toBe("error");
  }
});
it("handles rate limits without leaking upstream error details", async () => {
  const result = await loadAccountFunding("a", {
    transactionPage: vi
      .fn()
      .mockRejectedValue({ response: { status: 429, data: "PRIVATE" } }),
  } as unknown as Pick<ReadClient, "transactionPage">);
  expect(JSON.stringify(result)).toContain("rate limit");
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});
