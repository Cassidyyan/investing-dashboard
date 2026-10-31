import { afterEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ accounts: vi.fn() }));
vi.mock("snaptrade-typescript-sdk", () => ({
  Snaptrade: class {
    accountInformation = { listUserAccounts: sdk.accounts };
  },
  SnaptradeAuth: { personalApiKey: vi.fn(() => ({})) },
}));
import { getSnaptrade } from "@/server/snaptrade";
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
