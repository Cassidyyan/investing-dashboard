import { expect, it, vi } from "vitest";
import { createRequestProtection } from "@/server/request-protection";

it("shares only in-flight reads and releases results after completion", async () => {
  const protect = createRequestProtection();
  let complete!: (value: number) => void;
  const read = vi.fn(
    () =>
      new Promise<number>((resolve) => {
        complete = resolve;
      }),
  );
  const first = protect("accounts", read);
  const second = protect("accounts", read);
  expect(first).toBe(second);
  expect(read).toHaveBeenCalledTimes(1);
  complete(7);
  expect(await second).toBe(7);
  expect(await protect("accounts", async () => 9)).toBe(9);
});
it("limits concurrency and releases slots after a failed read", async () => {
  const protect = createRequestProtection(1);
  let reject!: (error: Error) => void;
  const first = protect(
    "first",
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const read = vi.fn(async () => 2);
  const second = protect("second", read);
  expect(read).not.toHaveBeenCalled();
  reject(Error("failure"));
  await expect(first).rejects.toThrow("failure");
  expect(await second).toBe(2);
});
it("honors Retry-After, blocks queued reads, and resumes without retrying a 429", async () => {
  let time = 0;
  const protect = createRequestProtection(1, () => time);
  const read = vi.fn(async () => {
    throw { response: { status: 429, headers: { "retry-after": "2" } } };
  });
  const queuedRead = vi.fn(async () => 1);
  const first = protect("accounts", read);
  const second = protect("balances", queuedRead);
  await expect(first).rejects.toMatchObject({ response: { status: 429 } });
  await expect(second).rejects.toMatchObject({ response: { status: 429 } });
  await expect(protect("history", queuedRead)).rejects.toMatchObject({
    response: { status: 429 },
  });
  expect(queuedRead).not.toHaveBeenCalled();
  expect(read).toHaveBeenCalledTimes(1);
  time = 2001;
  expect(await protect("accounts", queuedRead)).toBe(1);
});
it.each([undefined, "invalid"])(
  "uses a bounded default cooldown for %s Retry-After",
  async (retryAfter) => {
    let time = 0;
    const protect = createRequestProtection(3, () => time);
    await expect(
      protect("one", async () => {
        throw {
          response: { status: 429, headers: { "retry-after": retryAfter } },
        };
      }),
    ).rejects.toBeDefined();
    time = 29_999;
    await expect(protect("two", async () => 2)).rejects.toMatchObject({
      response: { status: 429 },
    });
    time = 30_001;
    expect(await protect("two", async () => 2)).toBe(2);
  },
);
it("honors an HTTP date Retry-After and isolates protection instances", async () => {
  let time = Date.parse("2026-10-28T12:00:00Z");
  const protect = createRequestProtection(1, () => time);
  await expect(
    protect("one", async () => {
      throw {
        response: {
          status: 429,
          headers: new Headers({
            "Retry-After": "Wed, 28 Oct 2026 12:01:00 GMT",
          }),
        },
      };
    }),
  ).rejects.toBeDefined();
  expect(await createRequestProtection()("one", async () => 3)).toBe(3);
  time += 59_000;
  await expect(protect("two", async () => 2)).rejects.toBeDefined();
  time += 1001;
  expect(await protect("two", async () => 2)).toBe(2);
});

it("extends the cooldown when another in-flight response has a longer Retry-After", async () => {
  let time = 0;
  const protect = createRequestProtection(2, () => time);
  let fail!: (error: unknown) => void;
  const second = protect(
    "two",
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  await expect(
    protect("one", async () => {
      throw { response: { status: 429, headers: { "retry-after": "2" } } };
    }),
  ).rejects.toBeDefined();
  fail({ response: { status: 429, headers: { "retry-after": "60" } } });
  await expect(second).rejects.toBeDefined();
  time = 3000;
  await expect(protect("three", async () => 3)).rejects.toBeDefined();
  time = 60001;
  expect(await protect("three", async () => 3)).toBe(3);
});

it.each(["", "-1", "1.5", "0x10", "1e2"])(
  "uses the safe default for invalid Retry-After %s",
  async (value) => {
    let time = 0;
    const protect = createRequestProtection(1, () => time);
    await expect(
      protect("one", async () => {
        throw { response: { status: 429, headers: { "Retry-After": value } } };
      }),
    ).rejects.toBeDefined();
    time = 2000;
    await expect(protect("two", async () => 2)).rejects.toBeDefined();
    time = 30001;
    expect(await protect("two", async () => 2)).toBe(2);
  },
);
it("accepts case-insensitive Retry-After headers and rejects invalid concurrency", async () => {
  let time = 0;
  const protect = createRequestProtection(1, () => time);
  await expect(
    protect("one", async () => {
      throw { response: { status: 429, headers: { "Retry-After": "60" } } };
    }),
  ).rejects.toBeDefined();
  time = 30001;
  await expect(protect("two", async () => 2)).rejects.toBeDefined();
  expect(() => createRequestProtection(0)).toThrow();
  expect(() => createRequestProtection(1.5)).toThrow();
});
