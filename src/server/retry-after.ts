import "server-only";
export function retryDelay(headers: unknown, now: number): number {
  let value: unknown;
  if (headers && typeof headers === "object") {
    if ("get" in headers && typeof headers.get === "function")
      value = headers.get("retry-after");
    else {
      const entry = Object.entries(headers).find(
        ([name]) => name.toLowerCase() === "retry-after",
      );
      value = entry?.[1];
    }
  }
  if (typeof value !== "string" && typeof value !== "number") return 30_000;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isSafeInteger(seconds) && Number.isFinite(seconds * 1000)
      ? Math.max(1000, seconds * 1000)
      : 30_000;
  }
  if (
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
      text,
    )
  ) {
    const delay = Date.parse(text) - now;
    if (Number.isFinite(delay)) return Math.max(1000, delay);
  }
  return 30_000;
}
