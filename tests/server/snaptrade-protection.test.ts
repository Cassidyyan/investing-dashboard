import { afterEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ accounts: vi.fn(), activities: vi.fn() }));
vi.mock("snaptrade-typescript-sdk", () => ({
  Snaptrade: class {
    accountInformation = {
      listUserAccounts: sdk.accounts,
      getAccountActivities: sdk.activities,
    };
  },
  SnaptradeAuth: { personalApiKey: vi.fn(() => ({})) },
}));
import { getSnaptrade } from "@/server/snaptrade";
import { loadTransactionSnapshot } from "@/server/transaction-pages";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("deduplicates simultaneous reads from separate adapter instances", async () => {
  vi.stubEnv("SNAPTRADE_CLIENT_ID", "test-client");
  vi.stubEnv("SNAPTRADE_CONSUMER_KEY", "test-key");
  let finish!: (value: unknown) => void;
  sdk.accounts.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = getSnaptrade()!.accounts();
  const second = getSnaptrade()!.accounts();
  expect(first).toBe(second);
  expect(sdk.accounts).toHaveBeenCalledTimes(1);
  finish({ data: [] });
  await first;
});
it("does not share an in-flight read across different credential scopes", async () => {
  vi.stubEnv("SNAPTRADE_CLIENT_ID", "test-other-client");
  vi.stubEnv("SNAPTRADE_CONSUMER_KEY", "test-key-one");
  sdk.accounts.mockResolvedValue({ data: [] });
  const first = getSnaptrade()!.accounts();
  vi.stubEnv("SNAPTRADE_CONSUMER_KEY", "test-key-two");
  const second = getSnaptrade()!.accounts();
  expect(first).not.toBe(second);
  await Promise.all([first, second]);
  expect(sdk.accounts).toHaveBeenCalledTimes(2);
});
it("reuses completed histories across adapters in the same credential scope without date filters", async () => {
  vi.stubEnv("SNAPTRADE_CLIENT_ID", "history-client");
  vi.stubEnv("SNAPTRADE_CONSUMER_KEY", "synthetic-history-key");
  sdk.activities.mockResolvedValue({
    data: { data: [{ id: "one" }], pagination: { total: 1 } },
  });
  const first = await loadTransactionSnapshot("account", getSnaptrade()!),
    second = await loadTransactionSnapshot("account", getSnaptrade()!);
  expect(first.coverage.cache).toBe("fresh");
  expect(second.coverage.cache).toBe("cached");
  expect(sdk.activities).toHaveBeenCalledTimes(1);
  expect(sdk.activities.mock.calls[0][0]).toEqual({
    accountId: "account",
    offset: 0,
    limit: 1000,
  });
  vi.stubEnv("SNAPTRADE_CONSUMER_KEY", "other-synthetic-history-key");
  await loadTransactionSnapshot("account", getSnaptrade()!);
  expect(sdk.activities).toHaveBeenCalledTimes(2);
});
it("uses only the installed Personal API auth mechanism, omitting Commercial user credentials", async () => {
  vi.stubEnv("SNAPTRADE_CLIENT_ID", "synthetic-personal-client");
  vi.stubEnv("SNAPTRADE_CONSUMER_KEY", "test-key");
  sdk.accounts.mockResolvedValue({ data: [] });
  const adapter = getSnaptrade()!;
  await adapter.accounts();
  const { SnaptradeAuth } = await import("snaptrade-typescript-sdk");
  expect(SnaptradeAuth.personalApiKey).toHaveBeenCalledWith({
    clientId: "synthetic-personal-client",
    consumerKey: "test-key",
  });
  expect(sdk.accounts.mock.calls[0][0]).toEqual({});
  expect(Object.keys(adapter)).not.toContain("trading");
  expect(Object.keys(adapter)).not.toContain("registerSnapTradeUser");
});
