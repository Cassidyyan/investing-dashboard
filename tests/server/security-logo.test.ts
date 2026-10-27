import { afterEach, expect, it, vi } from "vitest";
import { getSecurityLogoUrl } from "@/server/security-logo";

afterEach(() => vi.unstubAllEnvs());
it("keeps Canadian exchange suffixes and uses the ticker image API", () => {
  vi.stubEnv("LOGO_DEV_PUBLISHABLE_KEY", "pk_test_fixture");
  const result = getSecurityLogoUrl("VFV.TO", "etf");
  expect(result).not.toBeNull();
  const url = new URL(result!);
  expect(url.origin).toBe("https://img.logo.dev");
  expect(url.pathname).toBe("/ticker/VFV.TO");
  expect(url.searchParams.get("token")).toBe("pk_test_fixture");
  expect(url.searchParams.get("retina")).toBe("true");
  expect(url.searchParams.get("fallback")).toBe("404");
});
it("never constructs a browser URL from missing, malformed, or secret keys", () => {
  for (const key of ["", "sk_test_fixture", "invalid", "pk_bad key"]) {
    vi.stubEnv("LOGO_DEV_PUBLISHABLE_KEY", key);
    expect(getSecurityLogoUrl("AAPL", "stock")).toBeNull();
  }
});
it("rejects unexpected paths and uses local badges for unsupported instruments", () => {
  vi.stubEnv("LOGO_DEV_PUBLISHABLE_KEY", "pk_test_fixture");
  for (const symbol of [
    "../secret",
    "AAPL?token=other",
    "https://example.com",
  ]) {
    expect(getSecurityLogoUrl(symbol, "stock")).toBeNull();
  }
  expect(getSecurityLogoUrl("AAPL", "option")).toBeNull();
});
