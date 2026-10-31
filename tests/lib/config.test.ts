import { expect, it } from "vitest";
import { parseConfig } from "@/lib/config";
it("defaults new installations to generic account labels and reported option currencies", () => {
  const config = parseConfig({});
  expect(config.settings).toEqual({
    demo: false,
    optionsCurrency: "reported",
    cashOnlyAsHysa: false,
  });
  expect(config.credentials).toBeNull();
  expect(config.errors).toHaveLength(2);
});
it("accepts own Personal credentials and validates only safe public settings", () => {
  const config = parseConfig({
    SNAPTRADE_CLIENT_ID: " synthetic-client ",
    SNAPTRADE_CONSUMER_KEY: " synthetic-key ",
    HOLDINGS_OPTIONS_CURRENCY: "USD",
    HOLDINGS_CASH_ONLY_AS_HYSA: "true",
  });
  expect(config.credentials).toEqual({
    clientId: "synthetic-client",
    consumerKey: "synthetic-key",
  });
  expect(config.errors).toEqual([]);
  expect(JSON.stringify(config.settings)).not.toContain("synthetic");
});
it("rejects placeholders, public credential variables and invalid flags without echoing values", () => {
  const config = parseConfig({
    SNAPTRADE_CLIENT_ID: "your_personal_client_id",
    SNAPTRADE_CONSUMER_KEY: "PRIVATE invalid VALUE",
    HOLDINGS_DEMO_MODE: "invalid",
    HOLDINGS_OPTIONS_CURRENCY: "EUR",
    LOGO_DEV_PUBLISHABLE_KEY: "sk_PRIVATE",
    NEXT_PUBLIC_SNAPTRADE_CONSUMER_KEY: "PRIVATE_VALUE",
  });
  expect(config.credentials).toBeNull();
  expect(config.errors.length).toBeGreaterThan(3);
  expect(JSON.stringify(config.errors)).not.toMatch(/PRIVATE|your_personal/);
});
it("supports an explicit demo with no credentials", () => {
  const config = parseConfig({ HOLDINGS_DEMO_MODE: "true" });
  expect(config.settings.demo).toBe(true);
  expect(config.errors).toEqual([]);
});
