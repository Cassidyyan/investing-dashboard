import { afterEach, expect, it, vi } from "vitest";
import { getSnaptrade } from "@/server/snaptrade";
import { loadWealthsimpleDataset } from "@/server/wealthsimple-import";
import { POST } from "@/app/api/options-import/route";
import Overview from "@/app/page";
import Accounts from "@/app/accounts/page";
import Cash from "@/app/cash/page";
import Holdings from "@/app/holdings/page";
import Performance from "@/app/performance/page";
import Returns from "@/app/returns/page";
import Activity from "@/app/activity/page";
import Options from "@/app/options-analytics/page";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("demo overrides every page in production and never reads live credentials, exports or fetches", async () => {
  vi.stubEnv("HOLDINGS_DEMO_MODE", "true");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SNAPTRADE_CLIENT_ID", "PRIVATE_SYNTHETIC_CLIENT");
  vi.stubEnv("SNAPTRADE_CONSUMER_KEY", "PRIVATE_SYNTHETIC_KEY");
  const fetcher = vi.fn(() => {
    throw new Error("Network forbidden in demo");
  });
  vi.stubGlobal("fetch", fetcher);
  expect(getSnaptrade()).toBeNull();
  expect(
    await loadWealthsimpleDataset("/a/path/that/must/not/be/read"),
  ).toBeNull();
  for (const Page of [
    Overview,
    Accounts,
    Cash,
    Holdings,
    Performance,
    Returns,
    Activity,
    Options,
  ]) {
    const element = await Page({
      searchParams: Promise.resolve({ preview: "error" }),
    });
    expect(element.props.preview).toBe("sample");
    expect(JSON.stringify(element.props)).not.toContain("PRIVATE_SYNTHETIC");
  }
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    (
      await POST(
        new Request("http://localhost:3000/api/options-import", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(403);
});
