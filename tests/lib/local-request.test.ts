import { expect, it } from "vitest";
import { localRequestAllowed } from "@/lib/local-request";
it.each(["localhost:3000", "127.0.0.1:3000", "[::1]:3000"])(
  "allows a local request to %s",
  (host) => {
    expect(
      localRequestAllowed(new Headers({ host }), "http://localhost:3000/"),
    ).toBe(true);
  },
);
it("blocks DNS rebinding hostnames, cross-site fetches, cross-origin ports and opaque origins", () => {
  const attempts: Record<string, string>[] = [
    { host: "evil.invalid:3000" },
    { host: "localhost:3000", "sec-fetch-site": "cross-site" },
    { host: "localhost:3000", origin: "http://localhost:4000" },
    { host: "localhost:3000", origin: "null" },
    { host: "localhost.evil.invalid:3000" },
  ];
  for (const headers of attempts)
    expect(
      localRequestAllowed(new Headers(headers), "http://localhost:3000/"),
    ).toBe(false);
});
it("accepts the actual local browser authority instead of Next's internal hostname", () => {
  expect(
    localRequestAllowed(
      new Headers({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }),
      "http://localhost:3000/",
    ),
  ).toBe(true);
});
