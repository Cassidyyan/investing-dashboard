import { expect, it, vi } from "vitest";
import { historyDiagnostics } from "@/server/history-diagnostics";
import type { ReadClient } from "@/server/snaptrade";
it("returns a whitelist of aliases, dates and counts without identifiers, amounts or holdings", async () => {
  const client = {
    accounts: vi.fn(async () => ({
      data: [
        {
          id: "PRIVATE_ACCOUNT",
          name: "PRIVATE_NAME",
          number: "PRIVATE_NUMBER",
          brokerage_authorization: "PRIVATE_CONNECTION",
          account_category: "INVESTMENT",
          sync_status: {
            transactions: {
              initial_sync_completed: true,
              first_transaction_date: "2020-01-01",
            },
          },
        },
      ],
    })),
    connections: vi.fn(async () => ({
      data: [{ id: "PRIVATE_CONNECTION", disabled: false }],
    })),
    transactionPage: vi.fn(async () => ({
      data: {
        data: [
          {
            id: "PRIVATE_TRANSACTION",
            type: "BUY",
            symbol: { symbol: "PRIVATE_TICKER", raw_symbol: "PRIVATE_RAW" },
            amount: -123456789,
            trade_date: "2020-01-01",
            currency: { code: "USD" },
          },
        ],
        pagination: { total: 1 },
      },
    })),
    history: vi.fn(async () => ({
      data: {
        history: [{ date: "2026-01-01", total_value: "987654321" }],
        currency: "CAD",
      },
    })),
  } as unknown as ReadClient;
  const report = await historyDiagnostics(client),
    json = JSON.stringify(report);
  expect(report.accounts[0].alias).toBe("Account 1");
  expect(json).toContain("2020-01-01");
  expect(json).not.toContain("PRIVATE");
  expect(json).not.toContain("123456789");
  expect(json).not.toContain("987654321");
});
it("reports safe unavailable errors instead of upstream payloads", async () => {
  const client = {
    accounts: vi.fn().mockRejectedValue(new Error("PRIVATE")),
    connections: vi.fn().mockRejectedValue(new Error("PRIVATE")),
  } as unknown as ReadClient;
  const report = await historyDiagnostics(client);
  expect(report.error).toBe("Account list unavailable.");
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
});
