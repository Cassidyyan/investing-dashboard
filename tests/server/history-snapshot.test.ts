import { expect, it, vi } from "vitest";
import { loadTransactionSnapshot } from "@/server/transaction-pages";
import { loadAccountFunding } from "@/server/load-account-funding";
import { loadHoldingTransactions } from "@/server/load-holding-returns";
import type { ReadClient } from "@/server/snaptrade";
const client = (fn: ReturnType<typeof vi.fn>) =>
  ({ transactionPage: fn }) as Pick<ReadClient, "transactionPage">;
it("retrieves more than ten thousand records across years without an age filter", async () => {
  const request = vi.fn(
    async (_account: string, offset: number, limit: number) => ({
      data: {
        data: Array.from(
          { length: Math.min(limit, 11001 - offset) },
          (_, i) => ({
            id: String(offset + i),
            trade_date: offset === 0 ? "2026-10-30" : "2015-01-01",
          }),
        ),
        pagination: { total: 11001 },
      },
    }),
  );
  const result = await loadTransactionSnapshot("a", client(request));
  expect(result.coverage).toMatchObject({
    status: "complete",
    records: 11001,
    pages: 12,
    earliest: "2015-01-01",
    latest: "2026-10-30",
  });
  expect(request).toHaveBeenLastCalledWith("a", 11000, 1000);
});
it("finishes a full page without a total only after an explicit end page", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })),
      },
    })
    .mockResolvedValueOnce({ data: { data: [] } });
  const result = await loadTransactionSnapshot("a", client(request));
  expect(result.coverage).toMatchObject({
    status: "complete",
    records: 1000,
    pages: 2,
    expectedTotal: null,
  });
});
it("deduplicates identical rows but rejects changed IDs and whole repeated pages", async () => {
  const repeated = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
  const request = vi.fn().mockResolvedValue({
    data: { data: repeated, pagination: { total: 2000 } },
  });
  const stalled = await loadTransactionSnapshot("a", client(request));
  expect(stalled.coverage).toMatchObject({
    status: "partial",
    errorCode: "no_progress",
    records: 1000,
    duplicates: 1000,
  });
  expect(request).toHaveBeenCalledTimes(2);
  const conflict = await loadTransactionSnapshot(
    "a",
    client(
      vi.fn().mockResolvedValue({
        data: {
          data: [
            { id: "one", amount: 1 },
            { id: "one", amount: 2 },
          ],
          pagination: { total: 2 },
        },
      }),
    ),
  );
  expect(conflict.coverage).toMatchObject({
    status: "partial",
    errorCode: "conflicting_id",
    records: 1,
  });
});
it("preserves successful pages and partial funding evidence after a request failure", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: String(i),
          type: "CONTRIBUTION",
          trade_date: "2020-01-01",
          amount: 1,
          currency: { code: "CAD" },
        })),
        pagination: { total: 2000 },
      },
    })
    .mockRejectedValueOnce(new Error("PRIVATE payload"));
  const c = client(request),
    snapshot = await loadTransactionSnapshot("a", c);
  expect(snapshot.coverage).toMatchObject({
    status: "partial",
    records: 1000,
    errorCode: "request_failed",
  });
  const funding = await loadAccountFunding("a", c);
  expect(funding.status).toBe("error");
  if (funding.status !== "error") throw Error("fixture");
  expect(funding.partialData?.events).toHaveLength(1000);
  expect(JSON.stringify(snapshot)).not.toContain("PRIVATE");
  expect(request).toHaveBeenCalledTimes(2);
});
it("shares completed and in-flight histories across consumers but isolates accounts and clients", async () => {
  const request = vi.fn().mockResolvedValue({
      data: { data: [{ id: "one" }], pagination: { total: 1 } },
    }),
    c = client(request);
  const [first, second] = await Promise.all([
    loadTransactionSnapshot("a", c),
    loadTransactionSnapshot("a", { transactionPage: c.transactionPage }),
  ]);
  expect(first.coverage.cache).toBe("fresh");
  expect(second.coverage.cache).toBe("cached");
  expect(request).toHaveBeenCalledTimes(1);
  await loadAccountFunding("a", c);
  await loadHoldingTransactions(
    [{ account: { id: "a" } }] as Parameters<typeof loadHoldingTransactions>[0],
    c,
  );
  expect(request).toHaveBeenCalledTimes(1);
  await loadTransactionSnapshot("b", c);
  expect(request).toHaveBeenCalledTimes(2);
  const other = vi
    .fn()
    .mockResolvedValue({ data: { data: [], pagination: { total: 0 } } });
  await loadTransactionSnapshot("a", client(other));
  expect(other).toHaveBeenCalledTimes(1);
});
it("expires histories and supports a deliberate fresh diagnostic read", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(0);
  try {
    const request = vi
        .fn()
        .mockResolvedValue({ data: { data: [], pagination: { total: 0 } } }),
      c = client(request);
    await loadTransactionSnapshot("a", c);
    clock.mockReturnValue(59000);
    expect((await loadTransactionSnapshot("a", c)).coverage.cache).toBe(
      "cached",
    );
    clock.mockReturnValue(61000);
    expect((await loadTransactionSnapshot("a", c)).coverage.cache).toBe(
      "fresh",
    );
    await loadTransactionSnapshot("a", c, { force: true });
    expect(request).toHaveBeenCalledTimes(3);
  } finally {
    clock.mockRestore();
  }
});
it("marks a time-budget stop partial rather than pretending pagination completed", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(0);
  try {
    const request = vi.fn(async () => {
      clock.mockReturnValue(10);
      return {
        data: {
          data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })),
          pagination: { total: 2000 },
        },
      };
    });
    const result = await loadTransactionSnapshot("a", client(request), {
      maxDurationMs: 5,
    });
    expect(result.coverage).toMatchObject({
      status: "partial",
      errorCode: "time_budget_exceeded",
      records: 1000,
    });
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    clock.mockRestore();
  }
});
it("advances short pages by their actual size instead of imposing a 1,000-record minimum", async () => {
  const request = vi.fn(async (_account: string, offset: number) => ({
    data: {
      data: Array.from(
        { length: Math.min(offset === 0 ? 50 : 1000, 2000 - offset) },
        (_, i) => ({ id: String(offset + i) }),
      ),
      pagination: { total: 2000, offset },
    },
  }));
  const result = await loadTransactionSnapshot("a", client(request));
  expect(result.coverage).toMatchObject({
    status: "complete",
    records: 2000,
    pages: 3,
  });
  expect(request.mock.calls.map((call) => call[1])).toEqual([0, 50, 1050]);
});
it("does not assume a short page without a total proves the end of history", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: { data: [{ id: "one" }, { id: "two" }] } })
    .mockResolvedValueOnce({ data: { data: [{ id: "three" }] } })
    .mockResolvedValueOnce({ data: { data: [] } });
  const result = await loadTransactionSnapshot("a", client(request));
  expect(result.coverage).toMatchObject({
    status: "complete",
    records: 3,
    pages: 3,
  });
  expect(request.mock.calls.map((call) => call[1])).toEqual([0, 2, 3]);
});
it("rejects an ignored offset rather than silently accepting another first page", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({
      data: { data: [{ id: "one" }], pagination: { offset: 0, total: 2 } },
    })
    .mockResolvedValueOnce({
      data: {
        data: [{ id: "different" }],
        pagination: { offset: 0, total: 2 },
      },
    });
  const result = await loadTransactionSnapshot("a", client(request));
  expect(result.coverage).toMatchObject({
    status: "partial",
    errorCode: "offset_mismatch",
    records: 1,
  });
});
it("invalidates the history snapshot when transaction sync metadata changes", async () => {
  const request = vi
      .fn()
      .mockResolvedValue({ data: { data: [], pagination: { total: 0 } } }),
    c = client(request);
  const pending = {
    initialSyncCompleted: false,
    firstTransactionDate: null,
    lastSuccessfulSync: null,
    invalidMetadata: false,
  };
  await loadTransactionSnapshot("a", c, { sync: pending });
  await loadTransactionSnapshot("a", c, { sync: pending });
  expect(request).toHaveBeenCalledTimes(1);
  await loadTransactionSnapshot("a", c, {
    sync: {
      ...pending,
      initialSyncCompleted: true,
      lastSuccessfulSync: "2026-10-31",
    },
  });
  expect(request).toHaveBeenCalledTimes(2);
});
it("retains source evidence but blocks funding and stock ranking when initial transaction sync is incomplete", async () => {
  const c = client(
    vi.fn().mockResolvedValue({
      data: {
        data: [
          {
            id: "one",
            type: "CONTRIBUTION",
            amount: 10,
            currency: { code: "CAD" },
            trade_date: "2020-01-01",
          },
        ],
        pagination: { total: 1 },
      },
    }),
  );
  const sync = {
    initialSyncCompleted: false,
    firstTransactionDate: null,
    lastSuccessfulSync: null,
    invalidMetadata: false,
  };
  const funding = await loadAccountFunding("a", c, sync);
  expect(funding.status).toBe("error");
  if (funding.status !== "error") throw Error("fixture");
  expect(funding.partialData?.events).toHaveLength(1);
  expect(funding.partialData?.coverage?.status).toBe("complete");
  const [stocks] = await loadHoldingTransactions(
    [{ account: { id: "a", transactionSync: sync } }] as Parameters<
      typeof loadHoldingTransactions
    >[0],
    c,
  );
  expect(stocks.issues.join(" ")).toContain("synchronization is incomplete");
});
