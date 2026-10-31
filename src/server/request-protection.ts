import "server-only";
import { retryDelay } from "./retry-after";

class CooldownError extends Error {
  readonly response = { status: 429 };
  constructor() {
    super("Brokerage rate limit reached. Wait before refreshing.");
  }
}

// Process-local protection only. Completed responses and brokerage data are never cached.
export function createRequestProtection(concurrency = 3, now = Date.now) {
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new RangeError("Concurrency must be a positive integer.");
  const inFlight = new Map<string, Promise<unknown>>();
  const queue: (() => void)[] = [];
  let active = 0;
  let blockedUntil = 0;
  return function protect<T>(
    key: string,
    request: () => Promise<T>,
  ): Promise<T> {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;
    if (now() < blockedUntil) return Promise.reject(new CooldownError());
    if (queue.length >= 100)
      return Promise.reject(
        new Error("Too many pending brokerage reads. Try again shortly."),
      );
    const run = async () => {
      if (active >= concurrency)
        await new Promise<void>((resolve) => queue.push(resolve));
      else active++;
      try {
        // A queued request must respect a rate limit discovered while waiting.
        if (now() < blockedUntil) throw new CooldownError();
        return await request();
      } catch (error) {
        const response = (
          error as {
            response?: {
              status?: number;
              headers?:
                Record<string, unknown> | { get: (name: string) => unknown };
            };
          } | null
        )?.response;
        if (response?.status === 429 && !(error instanceof CooldownError)) {
          blockedUntil = Math.max(
            blockedUntil,
            now() + retryDelay(response.headers, now()),
          );
        }
        throw error;
      } finally {
        const next = queue.shift();
        if (next)
          next(); // Hand this concurrency slot directly to the next waiter.
        else active--;
      }
    };
    const promise = run().finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}
