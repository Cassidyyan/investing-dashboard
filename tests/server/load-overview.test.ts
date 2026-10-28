import { expect, it, vi, beforeEach } from "vitest";
import { loadOverview } from "@/server/load-overview";
import { loadPortfolio } from "@/server/load-portfolio";
import { loadPerformance } from "@/server/load-performance";
import { loadExchangeRate } from "@/server/exchange-rate";
import { createPerformancePreview } from "@/dev/previews/performance-preview";
import type { ReadClient } from "@/server/snaptrade";
vi.mock("@/server/load-portfolio", () => ({ loadPortfolio: vi.fn() }));
vi.mock("@/server/load-performance", () => ({ loadPerformance: vi.fn() }));
vi.mock("@/server/exchange-rate", () => ({ loadExchangeRate: vi.fn() }));
vi.mock("@/server/security-logo", () => ({ getSecurityLogoUrl: () => null }));
beforeEach(() => vi.clearAllMocks());
it("loads overview sections once and attaches shared history/funding without requesting legacy returns", async () => {
  const sample = createPerformancePreview();
  vi.mocked(loadPortfolio).mockResolvedValue(sample.portfolio);
  vi.mocked(loadPerformance).mockResolvedValue(sample.history);
  vi.mocked(loadExchangeRate).mockResolvedValue({
    status: "ok",
    data: { cadPerUsd: 1.4, asOf: "2026-10-10" },
  });
  const client = {} as ReadClient;
  const result = await loadOverview(client, sample.today);
  expect(loadPortfolio).toHaveBeenCalledExactlyOnceWith(
    client,
    ["balances", "activities"],
    "overview",
  );
  expect(loadPerformance).toHaveBeenCalledTimes(1);
  expect(loadPerformance).toHaveBeenCalledWith(expect.any(Array), client, {
    reportedReturns: false,
  });
  expect(result.historyByCurrency?.CAD?.ranges.All).toHaveLength(3);
  expect(result.historyByCurrency?.CAD?.gain?.percent).toBe(10);
  expect(result.activity).toEqual([]);
  expect(result.mock).toBe(false);
});
it("does not request history when the account list fails", async () => {
  const sample = createPerformancePreview();
  sample.portfolio.accounts = {
    status: "error",
    message: "Accounts unavailable",
  };
  vi.mocked(loadPortfolio).mockResolvedValue(sample.portfolio);
  vi.mocked(loadExchangeRate).mockResolvedValue({
    status: "error",
    message: "FX unavailable",
  });
  const result = await loadOverview(null, sample.today);
  expect(loadPerformance).not.toHaveBeenCalled();
  expect(result.error).toBe("Accounts unavailable");
  expect(result.activity).toBeNull();
});
