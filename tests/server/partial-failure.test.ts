import { it, expect, vi } from "vitest";
import { loadPortfolio } from "@/server/load-portfolio";
import type { ReadClient } from "@/server/snaptrade";
const response = (data: unknown) => Promise.resolve({ data });
function client() {
  return {
    accounts: vi.fn(() =>
      response(
        ["a", "b"].map((id) => ({
          id,
          name: id,
          number: "1234",
          balance: {},
          sync_status: {},
        })),
      ),
    ),
    connections: vi.fn(() => response([])),
    balances: vi.fn((id: string) =>
      id === "a"
        ? Promise.reject(new Error("SECRET upstream response"))
        : response([{ cash: 10, currency: { code: "CAD" } }]),
    ),
    positions: vi.fn<(accountId: string) => Promise<{ data: unknown }>>(() =>
      response({
        results: [
          {
            instrument: {
              kind: "stock",
              id: "test",
              symbol: "TEST",
              raw_symbol: "TEST",
            },
            units: "1",
            price: "10",
            currency: "CAD",
          },
        ],
        data_freshness: {},
      }),
    ),
    orders: vi.fn(() => response({ orders: [] })),
    activities: vi.fn(() => response({ data: [] })),
  };
}
it("keeps other sections and accounts when one balance call fails", async () => {
  const c = client();
  const p = await loadPortfolio(c as unknown as ReadClient);
  expect(p.accounts.status).toBe("ok");
  if (p.accounts.status !== "ok") throw Error("failed");
  expect(p.accounts.data).toHaveLength(2);
  expect(p.accounts.data[0].balances.status).toBe("error");
  expect(p.accounts.data[0].positions.status).toBe("ok");
  expect(p.accounts.data[1].balances.status).toBe("ok");
  expect(JSON.stringify(p)).not.toContain("SECRET");
  expect(c.positions).toHaveBeenCalledTimes(2);
});
it("still reports connection health when account listing fails", async () => {
  const c = client();
  c.accounts.mockImplementation(() => Promise.reject(new Error("private")));
  const p = await loadPortfolio(c as unknown as ReadClient);
  expect(p.accounts.status).toBe("error");
  expect(p.connections.status).toBe("ok");
  expect(c.balances).not.toHaveBeenCalled();
});
it("shows setup without attempting any API calls when unconfigured", async () => {
  const p = await loadPortfolio(null);
  expect(p.configured).toBe(false);
  expect(p.accounts.status).toBe("error");
});

it("requests positions for filtering and balances for the overview page", async () => {
  const c = client();
  const p = await loadPortfolio(c as unknown as ReadClient, ["balances"]);
  expect(p.accounts.status).toBe("ok");
  expect(c.balances).toHaveBeenCalledTimes(2);
  expect(c.positions).toHaveBeenCalledTimes(2);
  expect(c.orders).not.toHaveBeenCalled();
  expect(c.activities).not.toHaveBeenCalled();
});

it("requests only positions for the holdings page", async () => {
  const c = client();
  await loadPortfolio(c as unknown as ReadClient, ["positions"]);
  expect(c.positions).toHaveBeenCalledTimes(2);
  expect(c.balances).not.toHaveBeenCalled();
  expect(c.orders).not.toHaveBeenCalled();
  expect(c.activities).not.toHaveBeenCalled();
});

it("requests positions for filtering plus orders and activity for the activity page", async () => {
  const c = client();
  await loadPortfolio(c as unknown as ReadClient, ["orders", "activities"]);
  expect(c.orders).toHaveBeenCalledTimes(2);
  expect(c.activities).toHaveBeenCalledTimes(2);
  expect(c.balances).not.toHaveBeenCalled();
  expect(c.positions).toHaveBeenCalledTimes(2);
});

it("skips detail requests for confirmed zero-CAD and zero-USD accounts", async () => {
  const c = client();
  c.accounts.mockImplementation(() =>
    response([
      { id: "zero-cad", balance: { total: { amount: 0, currency: "CAD" } } },
      { id: "zero-usd", balance: { total: { amount: 0, currency: "USD" } } },
      { id: "missing", balance: { total: { currency: "CAD" } } },
      { id: "negative", balance: { total: { amount: -1, currency: "CAD" } } },
    ]),
  );
  const p = await loadPortfolio(c as unknown as ReadClient, ["positions"]);
  expect(c.positions.mock.calls.map((call) => call[0])).toEqual([
    "missing",
    "negative",
  ]);
  if (p.accounts.status !== "ok") throw Error("Expected accounts");
  expect(p.accounts.data.map((row) => row.account.id)).toEqual([
    "missing",
    "negative",
  ]);
});

it("hides confirmed empty accounts on every page before loading other details", async () => {
  const c = client();
  c.positions.mockImplementation(async (id) =>
    id === "a"
      ? { data: { results: [], data_freshness: {} } }
      : {
          data: {
            results: [
              {
                instrument: {
                  kind: "stock",
                  id: "test",
                  symbol: "TEST",
                  raw_symbol: "TEST",
                },
                units: "1",
              },
            ],
            data_freshness: {},
          },
        },
  );
  const p = await loadPortfolio(c as unknown as ReadClient, ["balances"]);
  if (p.accounts.status !== "ok") throw Error("Expected accounts");
  expect(p.accounts.data.map((a) => a.account.id)).toEqual(["b"]);
  expect(c.balances).not.toHaveBeenCalledWith("a");
  expect(c.balances).toHaveBeenCalledWith("b");
});

it("keeps accounts when holdings fail or quantities are unknown", async () => {
  const c = client();
  c.positions.mockImplementation(async (id) => {
    if (id === "a") throw Error("Private upstream error");
    return {
      data: {
        results: [
          {
            instrument: {
              kind: "stock",
              id: "test",
              symbol: "TEST",
              raw_symbol: "TEST",
            },
            units: null,
          },
        ],
        data_freshness: {},
      },
    };
  });
  const p = await loadPortfolio(c as unknown as ReadClient, ["positions"]);
  if (p.accounts.status !== "ok") throw Error("Expected accounts");
  expect(p.accounts.data).toHaveLength(2);
  expect(p.accounts.data[0].positions.status).toBe("error");
});

it("hides zero-unit positions but retains incomplete or stale empty accounts", async () => {
  const c = client();
  c.accounts.mockImplementation(() =>
    response([
      { id: "closed", sync_status: {} },
      {
        id: "incomplete",
        sync_status: { holdings: { initial_sync_completed: false } },
      },
      {
        id: "stale",
        sync_status: {
          holdings: { last_successful_sync: "2000-01-01T00:00:00Z" },
        },
      },
    ]),
  );
  c.positions.mockImplementation(async (id) => ({
    data: {
      results:
        id === "closed"
          ? [
              {
                instrument: {
                  kind: "stock",
                  id: "test",
                  symbol: "TEST",
                  raw_symbol: "TEST",
                },
                units: "0",
              },
            ]
          : [],
      data_freshness: {},
    },
  }));
  const p = await loadPortfolio(c as unknown as ReadClient, ["positions"]);
  if (p.accounts.status !== "ok") throw Error("Expected accounts");
  expect(p.accounts.data.map((a) => a.account.id)).toEqual([
    "incomplete",
    "stale",
  ]);
});

it("shows confirmed empty accounts on the cash page but excludes accounts with positions", async () => {
  const c = client();
  c.positions.mockImplementation(async (id) => ({
    data: {
      results:
        id === "a"
          ? []
          : [
              {
                instrument: {
                  kind: "stock",
                  id: "test",
                  symbol: "TEST",
                  raw_symbol: "TEST",
                },
                units: "1",
              },
            ],
      data_freshness: {},
    },
  }));
  const result = await loadPortfolio(
    c as unknown as ReadClient,
    ["balances"],
    "cash",
  );
  if (result.accounts.status !== "ok") throw Error("Expected accounts");
  expect(result.accounts.data.map((a) => a.account.id)).toEqual(["a"]);
  expect(c.balances).toHaveBeenCalledWith("a");
  expect(c.balances).not.toHaveBeenCalledWith("b");
  expect(c.orders).not.toHaveBeenCalled();
  expect(c.activities).not.toHaveBeenCalled();
});

it("uses explicit deposit categories without guessing from a failed holdings request, and excludes credit accounts", async () => {
  const c = client();
  c.accounts.mockImplementation(() =>
    response([
      { id: "bank", account_category: "DEPOSIT", sync_status: {} },
      { id: "credit", account_category: "LOC", sync_status: {} },
      { id: "unknown", account_category: "INVESTMENT", sync_status: {} },
    ]),
  );
  c.positions.mockRejectedValue(new Error("Positions unavailable"));
  const result = await loadPortfolio(
    c as unknown as ReadClient,
    ["balances"],
    "cash",
  );
  if (result.accounts.status !== "ok") throw Error("Expected accounts");
  expect(result.accounts.data.map((a) => a.account.id)).toEqual(["bank"]);
  expect(result.accounts.data[0].account.category).toBe("DEPOSIT");
  expect(c.positions).not.toHaveBeenCalledWith("bank");
  expect(c.positions).not.toHaveBeenCalledWith("credit");
});

it("keeps deposit accounts out of investing pages and zero-balance accounts out of the cash page", async () => {
  const c = client();
  c.accounts.mockImplementation(() =>
    response([
      { id: "bank", account_category: "DEPOSIT", sync_status: {} },
      {
        id: "zero",
        account_category: "DEPOSIT",
        balance: { total: { amount: 0, currency: "CAD" } },
        sync_status: {},
      },
      { id: "invest", account_category: "INVESTMENT", sync_status: {} },
    ]),
  );
  const investing = await loadPortfolio(c as unknown as ReadClient, [
    "positions",
  ]);
  if (investing.accounts.status !== "ok") throw Error("Expected accounts");
  expect(investing.accounts.data.map((a) => a.account.id)).toEqual(["invest"]);
  const cash = await loadPortfolio(
    c as unknown as ReadClient,
    ["balances"],
    "cash",
  );
  if (cash.accounts.status !== "ok") throw Error("Expected accounts");
  expect(cash.accounts.data.map((a) => a.account.id)).toEqual(["bank"]);
  expect(c.balances).not.toHaveBeenCalledWith("zero");
});

it("loads investing and cash accounts together for the overview without duplicate reads", async () => {
  const c = client();
  c.accounts.mockImplementation(() =>
    response([
      { id: "invest", account_category: "INVESTMENT", sync_status: {} },
      { id: "cash-only", account_category: "INVESTMENT", sync_status: {} },
      { id: "bank", account_category: "DEPOSIT", sync_status: {} },
      { id: "credit", account_category: "LOC", sync_status: {} },
    ]),
  );
  c.positions.mockImplementation(async (id) => ({
    data: {
      results:
        id === "cash-only"
          ? []
          : [
              {
                instrument: {
                  kind: "stock",
                  id: "test",
                  symbol: "TEST",
                  raw_symbol: "TEST",
                },
                units: "1",
              },
            ],
      data_freshness: {},
    },
  }));
  const result = await loadPortfolio(
    c as unknown as ReadClient,
    ["balances"],
    "overview",
  );
  if (result.accounts.status !== "ok") throw Error("Expected accounts");
  expect(result.accounts.data.map((a) => [a.account.id, a.cashOnly])).toEqual([
    ["invest", false],
    ["cash-only", true],
    ["bank", true],
  ]);
  expect(c.accounts).toHaveBeenCalledTimes(1);
  expect(c.positions).toHaveBeenCalledTimes(2);
  expect(c.balances).toHaveBeenCalledTimes(3);
  expect(c.balances).not.toHaveBeenCalledWith("credit");
});

it("includes zero-balance and cash-only investing accounts for lifetime analysis, excluding deposit and credit accounts", async () => {
  const c = client();
  c.accounts.mockImplementation(() =>
    response([
      {
        id: "sold",
        account_category: "INVESTMENT",
        balance: { total: { amount: 0, currency: "CAD" } },
      },
      { id: "cash-only", account_category: "INVESTMENT" },
      { id: "bank", account_category: "DEPOSIT" },
      { id: "credit", account_category: "LOC" },
    ]),
  );
  c.positions.mockImplementation(() =>
    response({ results: [], data_freshness: {} }),
  );
  const p = await loadPortfolio(
    c as unknown as ReadClient,
    ["positions"],
    "history",
  );
  if (p.accounts.status !== "ok") throw Error("Expected accounts");
  expect(p.accounts.data.map((a) => a.account.id)).toEqual([
    "sold",
    "cash-only",
  ]);
  expect(c.positions).toHaveBeenCalledTimes(2);
  expect(c.activities).not.toHaveBeenCalled();
});

it("keeps malformed account responses unavailable rather than crashing or claiming no accounts", async () => {
  const c = client();
  c.accounts.mockImplementation(() => response(null));
  const result = await loadPortfolio(c as unknown as ReadClient);
  expect(result.accounts.status).toBe("error");
  expect(result.connections.status).toBe("ok");
  expect(c.positions).not.toHaveBeenCalled();
});
it("does not request account data for a malformed null account row", async () => {
  const c = client();
  c.accounts.mockImplementation(() => response([null]));
  const result = await loadPortfolio(c as unknown as ReadClient);
  expect(result.accounts.status).toBe("ok");
  if (result.accounts.status !== "ok") throw Error("fixture");
  expect(result.accounts.data[0].account.incomplete).toBe(true);
  expect(c.positions).not.toHaveBeenCalled();
});
